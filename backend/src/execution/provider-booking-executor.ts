import { Prisma } from '@prisma/client';
import { env, MockExecutorOutcome } from '../config/env';
import { prisma } from '../config/database';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { providerFactory } from '../providers';
import { ProviderContext } from '../providers/base/provider-context';
import { BookingRequest, TravelProvider } from '../providers/base/travel-provider';
import { ExecutionStage, JourneyOption, SearchRequest } from '../providers/provider.types';
import { ProviderTimeoutError } from '../providers/provider-errors';
import { toDateOnly } from '../utils/mappers';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { isRetryableFailureCode } from '../queue/queue.types';
import {
  BookingExecutor,
  BookingExecutionContext,
  BookingExecutionResult,
} from './booking-executor';
import { mapProviderError, mapProviderResult } from './provider-result-mapper';

type PendingLog = {
  bookingTaskId: string;
  step: string;
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  metadata: Prisma.InputJsonValue;
};

export class ProviderBookingExecutor implements BookingExecutor {
  async execute(
    bookingTaskId: string,
    context: BookingExecutionContext,
  ): Promise<BookingExecutionResult> {
    const started = Date.now();
    const pendingLogs: PendingLog[] = [];

    const flush = async () => {
      if (pendingLogs.length === 0) {
        return;
      }
      const last = pendingLogs[pendingLogs.length - 1];
      await executionLogRepository.createMany(pendingLogs);
      pendingLogs.length = 0;
      if (last) {
        await prisma.bookingTask.update({
          where: { id: bookingTaskId },
          data: { currentStage: last.step },
        });
      }
    };

    const emit = async (
      stage: ExecutionStage,
      message: string,
      status: PendingLog['status'] = 'INFO',
      extra: Record<string, string | number | boolean | null> = {},
    ) => {
      const log: PendingLog = {
        bookingTaskId,
        step: stage,
        status,
        message,
        metadata: {
          provider: extra.provider ?? null,
          stage,
          durationMs: Date.now() - started,
          result: extra.result ?? status,
          errorCode: extra.errorCode ?? null,
          timestamp: new Date().toISOString(),
          ...extra,
        },
      };
      if (env.MOCK_EXECUTOR_STEP_DELAY_MS > 0 && env.NODE_ENV !== 'test') {
        await executionLogRepository.create(log);
        await prisma.bookingTask.update({
          where: { id: bookingTaskId },
          data: { currentStage: stage },
        });
      } else {
        pendingLogs.push(log);
      }
    };

    try {
      const result = await withTimeout(
        this.runWorkflow(bookingTaskId, context, emit, flush),
        env.BOOKING_EXECUTION_TIMEOUT_MS,
        () => new ProviderTimeoutError('Booking website timed out'),
      );
      await flush();
      return result;
    } catch (error) {
      const mapped = mapProviderError(error);
      const stage: ExecutionStage =
        mapped.outcome === 'AUTHENTICATION_REQUIRED'
          ? 'AUTHENTICATION_REQUIRED'
          : mapped.outcome === 'PAYMENT_REQUIRED'
            ? 'PAYMENT_REQUIRED'
            : mapped.outcome === 'UNKNOWN_RESULT'
              ? 'UNKNOWN_RESULT'
              : 'BOOKING_FAILED';
      await emit(
        stage,
        mappedFailureMessage(mapped),
        mapped.outcome === 'AUTHENTICATION_REQUIRED' || mapped.outcome === 'PAYMENT_REQUIRED'
          ? 'WARNING'
          : 'ERROR',
        {
          errorCode: 'failureCode' in mapped ? mapped.failureCode : null,
          result: mapped.outcome,
        },
      );
      await flush();
      return mapped;
    }
  }

  private async runWorkflow(
    bookingTaskId: string,
    context: BookingExecutionContext,
    emit: (
      stage: ExecutionStage,
      message: string,
      status?: PendingLog['status'],
      extra?: Record<string, string | number | boolean | null>,
    ) => Promise<void>,
    flush: () => Promise<void>,
  ): Promise<BookingExecutionResult> {
    const booking = await prisma.bookingTask.findUnique({
      where: { id: bookingTaskId },
      include: { passengers: { include: { passenger: true } } },
    });
    if (!booking) {
      return {
        outcome: 'FAILED',
        failureCode: 'BOOKING_NOT_FOUND',
        failureReason: 'Booking task no longer exists',
        retryable: false,
      };
    }

    const providerName = booking.provider.toUpperCase();
    const providerCtx: ProviderContext = {
      bookingTaskId,
      serviceType: booking.serviceType,
      provider: providerName,
      source: booking.source,
      destination: booking.destination,
      journeyDate: toDateOnly(booking.journeyDate),
      scheduledAt: booking.scheduledAt.toISOString(),
      trainNumber: booking.trainNumber,
      travelClass: booking.travelClass,
      quota: booking.quota,
      passengers: booking.passengers.map(({ passenger }) => ({
        name: passenger.name,
        age: passenger.age,
        gender: passenger.gender,
      })),
      mockOutcome: (booking.mockOutcome as MockExecutorOutcome | null) ?? null,
    };

    logger.info('Provider executor started', {
      service: 'executor',
      bookingTaskId,
      event: 'EXECUTOR_START',
      attemptNumber: context.attemptNumber,
      provider: providerName,
    });

    await emit('INITIALIZING', 'Initializing provider execution', 'INFO', { provider: providerName });
    if (await context.shouldCancel()) {
      await flush();
      return { outcome: 'CANCELLED', message: 'Cancellation requested during execution' };
    }

    const provider = providerFactory.get(booking.serviceType, providerName);
    await prisma.bookingTask.update({
      where: { id: bookingTaskId },
      data: { providerStatus: provider.getHealth() },
    });

    for (const capability of ['SEARCH', 'AVAILABILITY', 'BOOKING'] as const) {
      if (!provider.hasCapability(capability)) {
        return {
          outcome: 'FAILED',
          failureCode: 'PROVIDER_CAPABILITY_UNSUPPORTED',
          failureReason: `Provider ${providerName} does not support ${capability}`,
          retryable: false,
        };
      }
    }

    await emit('OPENING_PROVIDER', `Opening provider ${providerName}`, 'INFO', { provider: providerName });

    const searchRequest: SearchRequest = {
      serviceType: booking.serviceType,
      source: booking.source,
      destination: booking.destination,
      journeyDate: providerCtx.journeyDate,
      trainNumber: booking.trainNumber ?? undefined,
      serviceClass: booking.travelClass ?? undefined,
      quota: booking.quota ?? undefined,
      departureTime: booking.trainNumber === '20902' ? '15:51' : undefined,
    };

    if (await context.shouldCancel()) {
      await flush();
      return { outcome: 'CANCELLED', message: 'Cancellation requested during execution' };
    }

    await emit('SEARCHING', 'Searching journeys', 'INFO', { provider: providerName });
    const search = await provider.search(searchRequest, providerCtx);
    if (!search.found || search.journeys.length === 0) {
      return {
        outcome: 'FAILED',
        failureCode: 'TRAIN_NOT_FOUND',
        failureReason: search.message ?? 'Train not found',
        retryable: false,
      };
    }

    await emit('VERIFYING_JOURNEY', 'Verifying selected journey', 'INFO', { provider: providerName });
    const journey = search.journeys[0];

    if (await context.shouldCancel()) {
      await flush();
      return { outcome: 'CANCELLED', message: 'Cancellation requested during execution' };
    }

    await emit('CHECKING_AVAILABILITY', 'Checking seat availability', 'INFO', { provider: providerName });
    const availability = await provider.checkAvailability(
      {
        journey,
        travelClass: booking.travelClass ?? undefined,
        quota: booking.quota ?? undefined,
      },
      providerCtx,
    );
    if (!availability.available || availability.options.length === 0) {
      return {
        outcome: 'FAILED',
        failureCode: 'NO_SEATS',
        failureReason: availability.message ?? 'No seats available',
        retryable: false,
      };
    }

    const option = availability.options[0];
    if (option.status === 'UNKNOWN') {
      return {
        outcome: 'FAILED',
        failureCode: 'UNKNOWN_RESULT',
        failureReason: 'Seat availability could not be reliably determined',
        retryable: false,
      };
    }

    await emit('SELECTING_JOURNEY', `Selecting ${journey.trainNumber} ${journey.trainName}`, 'INFO', {
      provider: providerName,
    });
    await emit('SELECTING_CLASS', `Selecting class ${option.class}`, 'INFO', { provider: providerName });
    await emit('ENTERING_PASSENGER_DETAILS', 'Entering passenger details', 'INFO', { provider: providerName });

    const bookingRequest: BookingRequest = {
      context: providerCtx,
      search: searchRequest,
      journey,
      availability: option,
    };

    const prepared = await provider.prepareBooking(bookingRequest);
    if (!prepared.ready) {
      return {
        outcome: 'AUTHENTICATION_REQUIRED',
        failureCode: 'AUTHENTICATION_REQUIRED',
        failureReason: prepared.message,
      };
    }

    if (await context.shouldCancel()) {
      await flush();
      return { outcome: 'CANCELLED', message: 'Cancellation requested during execution' };
    }

    await emit('CONFIRMING_BOOKING', 'Confirming booking with provider', 'INFO', { provider: providerName });
    let mapped: BookingExecutionResult;
    try {
      mapped = mapProviderResult(await provider.executeBooking(bookingRequest));
    } catch (error) {
      const mappedError = mapProviderError(error);
      if (mappedError.outcome !== 'UNKNOWN_RESULT') {
        throw error;
      }
      mapped = mappedError;
    }

    if (mapped.outcome === 'UNKNOWN_RESULT') {
      mapped = await this.reconcile(provider, providerCtx, journey, mapped, emit);
    }

    if (mapped.outcome === 'SUCCESS') {
      await emit('BOOKING_CONFIRMED', mapped.message, 'SUCCESS', {
        provider: providerName,
        result: 'SUCCESS',
      });
    } else if (mapped.outcome === 'PAYMENT_REQUIRED') {
      await emit('PAYMENT_REQUIRED', mapped.failureReason, 'WARNING', {
        provider: providerName,
        result: 'PAYMENT_REQUIRED',
        errorCode: mapped.failureCode,
      });
    } else if (mapped.outcome === 'AUTHENTICATION_REQUIRED') {
      await emit('AUTHENTICATION_REQUIRED', mapped.failureReason, 'WARNING', {
        provider: providerName,
        result: 'AUTHENTICATION_REQUIRED',
        errorCode: mapped.failureCode,
      });
    } else if (mapped.outcome === 'UNKNOWN_RESULT') {
      await emit('UNKNOWN_RESULT', mapped.failureReason, 'ERROR', {
        provider: providerName,
        result: 'UNKNOWN_RESULT',
        errorCode: mapped.failureCode,
      });
    } else if (mapped.outcome === 'FAILED') {
      await emit('BOOKING_FAILED', mapped.failureReason, 'ERROR', {
        provider: providerName,
        result: 'FAILED',
        errorCode: mapped.failureCode,
      });
    }

    if (mapped.outcome === 'FAILED') {
      return {
        ...mapped,
        retryable: mapped.retryable && isRetryableFailureCode(mapped.failureCode),
      };
    }

    return mapped;
  }

  /**
   * Phase 4.7: never blindly retry an ambiguous booking result. When the
   * provider can report booking status, ask it once and resolve the state.
   * If it still cannot tell, the booking stays UNKNOWN_RESULT for human review.
   */
  private async reconcile(
    provider: TravelProvider,
    context: ProviderContext,
    journey: JourneyOption,
    unknown: BookingExecutionResult,
    emit: (
      stage: ExecutionStage,
      message: string,
      status?: PendingLog['status'],
      extra?: Record<string, string | number | boolean | null>,
    ) => Promise<void>,
  ): Promise<BookingExecutionResult> {
    if (
      !env.PROVIDER_RECONCILE_ENABLED ||
      !provider.hasCapability('STATUS_RECONCILIATION') ||
      typeof provider.getBookingStatus !== 'function'
    ) {
      return unknown;
    }

    await emit('RECONCILING', 'Reconciling ambiguous booking result with provider', 'WARNING', {
      provider: provider.getProviderName(),
    });

    try {
      const status = await provider.getBookingStatus({ providerBookingReference: '', journey }, context);
      if (status.state === 'CONFIRMED') {
        return {
          outcome: 'SUCCESS',
          bookingReference: status.providerBookingReference ?? `REF-${Date.now()}`,
          message: `Reconciliation confirmed the booking. ${status.message}`,
        };
      }
      if (status.state === 'FAILED' || status.state === 'NOT_FOUND' || status.state === 'CANCELLED') {
        return {
          outcome: 'FAILED',
          failureCode: 'BOOKING_NOT_CONFIRMED',
          failureReason: `Reconciliation confirmed the booking did not complete. ${status.message}`,
          retryable: false,
        };
      }
      return {
        ...(unknown as Extract<BookingExecutionResult, { outcome: 'UNKNOWN_RESULT' }>),
        failureReason: `${unknown.outcome === 'UNKNOWN_RESULT' ? unknown.failureReason : ''} Reconciliation was inconclusive.`.trim(),
      };
    } catch {
      return unknown;
    }
  }
}

function mappedFailureMessage(result: BookingExecutionResult): string {
  if (result.outcome === 'CANCELLED') {
    return result.message;
  }
  if (result.outcome === 'SUCCESS') {
    return result.message;
  }
  return result.failureReason;
}

export const providerBookingExecutor = new ProviderBookingExecutor();
