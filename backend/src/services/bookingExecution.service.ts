import { AttemptStatus, BookingStatus } from '@prisma/client';
import { UnrecoverableError, type Job as BullJob } from 'bullmq';
import { bookingRepository } from '../repositories/booking.repository';
import { bookingAttemptRepository } from '../repositories/bookingAttempt.repository';
import { providerBookingExecutor } from '../execution/provider-booking-executor';
import { BookingExecutor, RetryableExecutionError } from '../execution/booking-executor';
import { actionTypeForOutcome } from '../execution/provider-result-mapper';
import { transitionBookingState } from '../execution/booking-state-machine';
import { BookingExecutionJob, isRetryableFailureCode } from '../queue/queue.types';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { acquireBookingLock, releaseBookingLock } from '../queue/booking-lock';

function getExecutor(): BookingExecutor {
  return providerBookingExecutor;
}

export const bookingExecutionService = {
  async execute(job: BullJob<BookingExecutionJob>): Promise<void> {
    const bookingTaskId = job.data.bookingTaskId;
    const jobId = String(job.id);

    logger.info('Executing booking job', {
      service: 'worker',
      bookingTaskId,
      jobId,
      event: 'JOB_EXECUTE',
      attemptsMade: job.attemptsMade,
    });

    const lock = await acquireBookingLock(bookingTaskId, jobId);
    if (!lock) {
      logger.info('Could not acquire booking lock', {
        service: 'worker',
        bookingTaskId,
        jobId,
        event: 'LOCK_SKIP',
      });
      return;
    }

    try {
      await this.executeLocked(job);
    } finally {
      await releaseBookingLock(bookingTaskId, jobId);
    }
  },

  async executeLocked(job: BullJob<BookingExecutionJob>): Promise<void> {
    const bookingTaskId = job.data.bookingTaskId;
    const jobId = String(job.id);
    const attemptsAllowed = job.opts.attempts ?? env.BOOKING_JOB_ATTEMPTS;
    const isLastAttempt = job.attemptsMade + 1 >= attemptsAllowed;

    const booking = await bookingRepository.findById(bookingTaskId);
    if (!booking) {
      logger.warn('Booking missing for job', { service: 'worker', bookingTaskId, jobId, event: 'BOOKING_MISSING' });
      return;
    }

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.FAILED
    ) {
      logger.info('Skipping terminal booking', {
        service: 'worker',
        bookingTaskId,
        jobId,
        event: 'IDEMPOTENT_SKIP',
        status: booking.status,
      });
      return;
    }

    if (booking.cancellationRequested) {
      if (booking.status === BookingStatus.RUNNING || booking.status === BookingStatus.QUEUED) {
        await transitionBookingState(bookingTaskId, BookingStatus.CANCELLED, {
          message: 'Booking cancelled before or during execution',
          cancellationRequested: true,
        });
      }
      return;
    }

    if (booking.status === BookingStatus.RUNNING) {
      const active = await bookingAttemptRepository.findActive(bookingTaskId);
      if (active) {
        logger.info('Another worker is already processing this booking', {
          service: 'worker',
          bookingTaskId,
          jobId,
          event: 'DUPLICATE_SKIP',
          status: booking.status,
        });
        return;
      }
    }

    if (booking.status === BookingStatus.SCHEDULED) {
      await transitionBookingState(bookingTaskId, BookingStatus.QUEUED);
    }

    const current = await bookingRepository.findById(bookingTaskId);
    if (!current) {
      return;
    }

    if (current.status === BookingStatus.QUEUED) {
      await transitionBookingState(bookingTaskId, BookingStatus.RUNNING, {
        startedAt: current.startedAt ?? new Date(),
        lastAttemptAt: new Date(),
      });
    } else if (current.status !== BookingStatus.RUNNING) {
      logger.warn('Booking is not executable', {
        service: 'worker',
        bookingTaskId,
        jobId,
        event: 'UNEXPECTED_STATUS',
        status: current.status,
      });
      return;
    }

    const attemptNumber = await bookingAttemptRepository.nextAttemptNumber(bookingTaskId);
    const attempt = await bookingAttemptRepository.create({
      bookingTaskId,
      attemptNumber,
      status: AttemptStatus.RUNNING,
      startedAt: new Date(),
    });

    await bookingRepository.update(bookingTaskId, {
      retryCount: Math.max(0, attemptNumber - 1),
      lastAttemptAt: new Date(),
    });

    const result = await getExecutor().execute(bookingTaskId, {
      bookingTaskId,
      attemptNumber,
      shouldCancel: async () => {
        const latest = await bookingRepository.findById(bookingTaskId);
        return Boolean(latest?.cancellationRequested);
      },
    });

    if (result.outcome === 'CANCELLED') {
      await bookingAttemptRepository.update(attempt.id, {
        status: AttemptStatus.CANCELLED,
        endedAt: new Date(),
      });
      const latest = await bookingRepository.findById(bookingTaskId);
      if (latest && latest.status === BookingStatus.RUNNING) {
        await transitionBookingState(bookingTaskId, BookingStatus.CANCELLED, {
          message: result.message,
        });
      }
      return;
    }

    if (result.outcome === 'SUCCESS') {
      await bookingAttemptRepository.update(attempt.id, {
        status: AttemptStatus.SUCCESS,
        endedAt: new Date(),
      });
      try {
        await transitionBookingState(bookingTaskId, BookingStatus.COMPLETED, {
          completedAt: new Date(),
          bookingReference: result.bookingReference,
          message: result.message,
          metadata: { bookingReference: result.bookingReference },
          actionRequired: false,
          actionRequiredType: 'NONE',
          actionRequiredMessage: null,
          currentStage: 'BOOKING_CONFIRMED',
          providerStatus: 'AVAILABLE',
        });
      } catch (error) {
        const latest = await bookingRepository.findById(bookingTaskId);
        if (latest?.status === BookingStatus.COMPLETED) {
          return;
        }
        throw error;
      }
      return;
    }

    if (result.outcome === 'AUTHENTICATION_REQUIRED') {
      await bookingAttemptRepository.update(attempt.id, {
        status: AttemptStatus.FAILED,
        endedAt: new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureReason,
      });
      await transitionBookingState(bookingTaskId, BookingStatus.AUTHENTICATION_REQUIRED, {
        failureCode: result.failureCode,
        failureReason: result.failureReason,
        message: result.failureReason,
        actionRequired: true,
        actionRequiredType: actionTypeForOutcome(result) ?? 'LOGIN',
        actionRequiredMessage: result.failureReason,
        currentStage: 'AUTHENTICATION_REQUIRED',
      });
      throw new UnrecoverableError(result.failureReason);
    }

    if (result.outcome === 'PAYMENT_REQUIRED') {
      await bookingAttemptRepository.update(attempt.id, {
        status: AttemptStatus.FAILED,
        endedAt: new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureReason,
      });
      await transitionBookingState(bookingTaskId, BookingStatus.PAYMENT_REQUIRED, {
        failureCode: result.failureCode,
        failureReason: result.failureReason,
        message: result.failureReason,
        actionRequired: true,
        actionRequiredType: 'PAYMENT',
        actionRequiredMessage: result.failureReason,
        currentStage: 'PAYMENT_REQUIRED',
      });
      throw new UnrecoverableError(result.failureReason);
    }

    if (result.outcome === 'UNKNOWN_RESULT') {
      await bookingAttemptRepository.update(attempt.id, {
        status: AttemptStatus.FAILED,
        endedAt: new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureReason,
      });
      await transitionBookingState(bookingTaskId, BookingStatus.FAILED, {
        failedAt: new Date(),
        failureCode: result.failureCode,
        failureReason: result.failureReason,
        message: result.failureReason,
        actionRequired: result.outcome === 'UNKNOWN_RESULT',
        actionRequiredType: result.outcome === 'UNKNOWN_RESULT' ? 'MANUAL_REVIEW' : 'NONE',
        actionRequiredMessage: result.outcome === 'UNKNOWN_RESULT' ? result.failureReason : null,
        currentStage: result.outcome === 'UNKNOWN_RESULT' ? 'UNKNOWN_RESULT' : 'BOOKING_FAILED',
      });
      throw new UnrecoverableError(result.failureReason);
    }

    await bookingAttemptRepository.update(attempt.id, {
      status: AttemptStatus.FAILED,
      endedAt: new Date(),
      failureCode: result.failureCode,
      failureReason: result.failureReason,
    });

    const retryable = result.retryable && isRetryableFailureCode(result.failureCode) && !isLastAttempt;
    if (retryable) {
      await transitionBookingState(bookingTaskId, BookingStatus.QUEUED, {
        failureCode: result.failureCode,
        failureReason: result.failureReason,
        retryCount: attemptNumber,
        message: `Transient failure (${result.failureCode}). Retrying booking execution.`,
        metadata: { retryable: true, attemptNumber },
      });
      throw new RetryableExecutionError(result.failureCode, result.failureReason);
    }

    await transitionBookingState(bookingTaskId, BookingStatus.FAILED, {
      failedAt: new Date(),
      failureCode: result.failureCode,
      failureReason: result.failureReason,
      retryCount: Math.max(0, attemptNumber - 1),
      message: result.failureReason,
      actionRequired: false,
      actionRequiredType: 'NONE',
      actionRequiredMessage: null,
      currentStage: 'BOOKING_FAILED',
    });
    throw new UnrecoverableError(result.failureReason);
  },
};
