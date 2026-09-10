import { BookingStatus, Passenger } from '@prisma/client';
import { bookingRepository, BookingWithPassengers } from '../repositories/booking.repository';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { humanActionRepository } from '../repositories/humanAction.repository';
import { passengerService } from './passenger.service';
import { bookingScheduler } from '../scheduler/booking-scheduler';
import { transitionBookingState } from '../execution/booking-state-machine';
import { AppError } from '../utils/AppError';
import { toDateOnly } from '../utils/mappers';
import { env, MockExecutorOutcome } from '../config/env';
import { CreateBookingInput, UpdateBookingInput } from '../schemas/booking.schema';
import { providerFactory } from '../providers';

const LOCKED_STATUSES: BookingStatus[] = [
  BookingStatus.RUNNING,
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.FAILED,
  BookingStatus.AUTHENTICATION_REQUIRED,
  BookingStatus.PAYMENT_REQUIRED,
];

export type BookingPassengerView = {
  id: string;
  name: string;
  age: number;
  gender: Passenger['gender'];
  phone: string;
};

export type BookingView = {
  id: string;
  serviceType: BookingWithPassengers['serviceType'];
  provider: string;
  source: string;
  destination: string;
  journeyDate: string;
  scheduledAt: string;
  trainNumber: string | null;
  travelClass: string | null;
  quota: string | null;
  status: BookingStatus;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  retryCount: number;
  failureCode: string | null;
  failureReason: string | null;
  lastAttemptAt: string | null;
  bookingReference: string | null;
  cancellationRequested: boolean;
  actionRequired: boolean;
  actionRequiredType: string;
  actionRequiredMessage: string | null;
  currentStage: string | null;
  providerStatus: string | null;
  artifactId: string | null;
  passengers: BookingPassengerView[];
  createdAt: string;
  updatedAt: string;
};

export function toBookingView(booking: BookingWithPassengers): BookingView {
  return {
    id: booking.id,
    serviceType: booking.serviceType,
    provider: booking.provider,
    source: booking.source,
    destination: booking.destination,
    journeyDate: toDateOnly(booking.journeyDate),
    scheduledAt: booking.scheduledAt.toISOString(),
    trainNumber: booking.trainNumber,
    travelClass: booking.travelClass,
    quota: booking.quota,
    status: booking.status,
    startedAt: booking.startedAt?.toISOString() ?? null,
    completedAt: booking.completedAt?.toISOString() ?? null,
    failedAt: booking.failedAt?.toISOString() ?? null,
    retryCount: booking.retryCount,
    failureCode: booking.failureCode,
    failureReason: booking.failureReason,
    lastAttemptAt: booking.lastAttemptAt?.toISOString() ?? null,
    bookingReference: booking.bookingReference,
    cancellationRequested: booking.cancellationRequested,
    actionRequired: booking.actionRequired,
    actionRequiredType: booking.actionRequiredType,
    actionRequiredMessage: booking.actionRequiredMessage,
    currentStage: booking.currentStage,
    providerStatus: booking.providerStatus,
    artifactId: booking.artifactId,
    passengers: booking.passengers.map(({ passenger }) => ({
      id: passenger.id,
      name: passenger.name,
      age: passenger.age,
      gender: passenger.gender,
      phone: passenger.phone,
    })),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

function resolveInitialStatus(scheduledAt: Date): BookingStatus {
  return scheduledAt.getTime() > Date.now() ? BookingStatus.SCHEDULED : BookingStatus.DRAFT;
}

function parseJourneyDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function requireOwned(userId: string, bookingId: string): Promise<BookingWithPassengers> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.userId !== userId) {
    throw AppError.notFound('Booking task not found');
  }
  return booking;
}

export const bookingService = {
  async create(userId: string, input: CreateBookingInput): Promise<BookingView> {
    await passengerService.assertOwnedByUser(userId, input.passengerIds);

    const provider = input.provider.trim().toUpperCase();
    if (!providerFactory.isSupported(input.serviceType, provider)) {
      throw AppError.unsupportedProvider(
        `Unsupported provider combination: ${input.serviceType} + ${provider}`,
      );
    }

    const scheduledAt = new Date(input.scheduledAt);
    const status = resolveInitialStatus(scheduledAt);
    const booking = await bookingRepository.create({
      userId,
      serviceType: input.serviceType,
      provider,
      source: input.source.toUpperCase(),
      destination: input.destination.toUpperCase(),
      journeyDate: parseJourneyDate(input.journeyDate),
      scheduledAt,
      trainNumber: input.trainNumber,
      travelClass: input.travelClass,
      quota: input.quota,
      status,
      passengerIds: input.passengerIds,
    });

    await executionLogRepository.create({
      bookingTaskId: booking.id,
      step: 'BOOKING_CREATED',
      status: 'INFO',
      message: 'Booking task created',
    });

    if (status === BookingStatus.SCHEDULED) {
      await bookingScheduler.scheduleBooking(booking.id, userId);
    }

    const latest = await bookingRepository.findById(booking.id);
    return toBookingView(latest ?? booking);
  },

  async list(userId: string): Promise<BookingView[]> {
    const bookings = await bookingRepository.findByUser(userId);
    return bookings.map(toBookingView);
  },

  async getById(userId: string, bookingId: string): Promise<BookingView> {
    const booking = await requireOwned(userId, bookingId);
    return toBookingView(booking);
  },

  async update(userId: string, bookingId: string, input: UpdateBookingInput): Promise<BookingView> {
    const existing = await requireOwned(userId, bookingId);
    if (LOCKED_STATUSES.includes(existing.status)) {
      throw AppError.conflict(`Cannot update a booking in ${existing.status} status`);
    }

    if (input.passengerIds) {
      await passengerService.assertOwnedByUser(userId, input.passengerIds);
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    const updated = await bookingRepository.update(
      bookingId,
      {
        ...(input.serviceType ? { serviceType: input.serviceType } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.source ? { source: input.source.toUpperCase() } : {}),
        ...(input.destination ? { destination: input.destination.toUpperCase() } : {}),
        ...(input.journeyDate ? { journeyDate: parseJourneyDate(input.journeyDate) } : {}),
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(input.trainNumber !== undefined ? { trainNumber: input.trainNumber } : {}),
        ...(input.travelClass !== undefined ? { travelClass: input.travelClass } : {}),
        ...(input.quota !== undefined ? { quota: input.quota } : {}),
      },
      input.passengerIds,
    );

    await executionLogRepository.create({
      bookingTaskId: bookingId,
      step: 'TASK_UPDATED',
      status: 'INFO',
      message: 'Booking task updated.',
    });

    if (scheduledAt && updated.status === BookingStatus.SCHEDULED) {
      await bookingScheduler.rescheduleBooking(bookingId, scheduledAt.toISOString(), userId);
    }

    const latest = await bookingRepository.findById(bookingId);
    return toBookingView(latest ?? updated);
  },

  async remove(userId: string, bookingId: string): Promise<void> {
    const existing = await requireOwned(userId, bookingId);
    if (existing.status === BookingStatus.RUNNING) {
      throw AppError.conflict('Cannot delete a running booking task');
    }
    await bookingScheduler.cancelScheduledBooking(bookingId);
    await bookingRepository.delete(bookingId);
  },

  async cancel(userId: string, bookingId: string): Promise<BookingView> {
    const existing = await requireOwned(userId, bookingId);
    if (existing.status === BookingStatus.CANCELLED) {
      return toBookingView(existing);
    }
    if (existing.status === BookingStatus.COMPLETED || existing.status === BookingStatus.FAILED) {
      throw AppError.conflict(`${existing.status} bookings cannot be cancelled`);
    }

    if (existing.status === BookingStatus.RUNNING) {
      await bookingRepository.update(bookingId, { cancellationRequested: true });
      await executionLogRepository.create({
        bookingTaskId: bookingId,
        step: 'CANCELLATION_REQUESTED',
        status: 'WARNING',
        message: 'Cancellation requested. The worker will stop after the current safe step.',
      });
      const latest = await bookingRepository.findById(bookingId);
      return toBookingView(latest ?? existing);
    }

    await humanActionRepository.closePendingForBooking(bookingId, 'CANCELLED');
    await bookingScheduler.cancelScheduledBooking(bookingId);
    const updated = await transitionBookingState(bookingId, BookingStatus.CANCELLED, {
      cancellationRequested: true,
      queueJobId: null,
      message: 'Booking task cancelled by user',
    });
    return toBookingView(updated);
  },

  async reschedule(userId: string, bookingId: string, scheduledAt: string): Promise<BookingView> {
    await requireOwned(userId, bookingId);
    const updated = await bookingScheduler.rescheduleBooking(bookingId, scheduledAt, userId);
    if (!updated) {
      throw AppError.notFound('Booking task not found');
    }
    return toBookingView(updated);
  },

  async runNow(userId: string, bookingId: string, mockOutcome?: MockExecutorOutcome): Promise<BookingView> {
    if (env.NODE_ENV === 'production') {
      throw AppError.forbidden('Manual run is only available in development');
    }
    const existing = await requireOwned(userId, bookingId);
    if (existing.status !== BookingStatus.SCHEDULED) {
      throw AppError.conflict(`Cannot run a booking in ${existing.status} status`);
    }
    if (mockOutcome) {
      await bookingRepository.update(bookingId, { mockOutcome });
    }
    await bookingScheduler.cancelScheduledBooking(bookingId);
    const queued = await transitionBookingState(bookingId, BookingStatus.QUEUED);
    await bookingScheduler.enqueueImmediately(bookingId, userId);
    const latest = await bookingRepository.findById(bookingId);
    return toBookingView(latest ?? queued);
  },

  async resume(userId: string, bookingId: string): Promise<BookingView> {
    const existing = await requireOwned(userId, bookingId);
    if (
      existing.status !== BookingStatus.AUTHENTICATION_REQUIRED &&
      existing.status !== BookingStatus.PAYMENT_REQUIRED &&
      existing.status !== BookingStatus.UNKNOWN_RESULT
    ) {
      throw AppError.conflict(`Cannot resume a booking in ${existing.status} status`);
    }

    await humanActionRepository.closePendingForBooking(bookingId, 'RESOLVED');
    await bookingScheduler.cancelScheduledBooking(bookingId);
    const queued = await transitionBookingState(bookingId, BookingStatus.QUEUED, {
      actionRequired: false,
      actionRequiredType: 'NONE',
      actionRequiredMessage: null,
      message: 'Execution resumed after a human-required action was completed',
    });
    await bookingScheduler.enqueueImmediately(bookingId, userId);
    const latest = await bookingRepository.findById(bookingId);
    return toBookingView(latest ?? queued);
  },

  async getLogs(userId: string, bookingId: string) {
    await this.getById(userId, bookingId);
    return executionLogRepository.findByBookingTask(bookingId);
  },
};
