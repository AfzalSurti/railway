import { ActionRequiredType, BookingStatus, ExecutionStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: [BookingStatus.SCHEDULED, BookingStatus.CANCELLED],
  SCHEDULED: [BookingStatus.QUEUED, BookingStatus.CANCELLED],
  QUEUED: [BookingStatus.RUNNING, BookingStatus.CANCELLED],
  RUNNING: [
    BookingStatus.AUTHENTICATION_REQUIRED,
    BookingStatus.PAYMENT_REQUIRED,
    BookingStatus.COMPLETED,
    BookingStatus.FAILED,
    BookingStatus.CANCELLED,
    BookingStatus.QUEUED,
  ],
  AUTHENTICATION_REQUIRED: [BookingStatus.QUEUED, BookingStatus.RUNNING, BookingStatus.FAILED, BookingStatus.CANCELLED],
  PAYMENT_REQUIRED: [BookingStatus.QUEUED, BookingStatus.RUNNING, BookingStatus.FAILED, BookingStatus.CANCELLED],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

const STEP_BY_STATE: Record<BookingStatus, { step: string; status: ExecutionStatus; message: string }> = {
  DRAFT: { step: 'BOOKING_DRAFT', status: 'INFO', message: 'Booking task saved as draft' },
  SCHEDULED: { step: 'BOOKING_SCHEDULED', status: 'INFO', message: 'Booking scheduled' },
  QUEUED: { step: 'BOOKING_QUEUED', status: 'INFO', message: 'Booking added to execution queue' },
  RUNNING: { step: 'BOOKING_STARTED', status: 'INFO', message: 'Booking execution started' },
  AUTHENTICATION_REQUIRED: {
    step: 'AUTHENTICATION_REQUIRED',
    status: 'WARNING',
    message: 'Booking paused: authentication required',
  },
  PAYMENT_REQUIRED: {
    step: 'PAYMENT_REQUIRED',
    status: 'WARNING',
    message: 'Booking paused: payment required',
  },
  COMPLETED: { step: 'BOOKING_COMPLETED', status: 'SUCCESS', message: 'Mock booking completed successfully' },
  FAILED: { step: 'BOOKING_FAILED', status: 'ERROR', message: 'Booking execution failed' },
  CANCELLED: { step: 'BOOKING_CANCELLED', status: 'WARNING', message: 'Booking task cancelled' },
};

export type TransitionExtras = {
  message?: string;
  metadata?: Prisma.InputJsonValue;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureReason?: string | null;
  retryCount?: number;
  lastAttemptAt?: Date | null;
  bookingReference?: string | null;
  queueJobId?: string | null;
  cancellationRequested?: boolean;
  actionRequired?: boolean;
  actionRequiredType?: ActionRequiredType;
  actionRequiredMessage?: string | null;
  currentStage?: string | null;
  providerStatus?: string | null;
  artifactId?: string | null;
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertCanTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw AppError.conflict(`Invalid booking state transition: ${from} → ${to}`);
  }
}

export async function transitionBookingState(
  bookingTaskId: string,
  newState: BookingStatus,
  extras: TransitionExtras = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingTask.findUnique({ where: { id: bookingTaskId } });
    if (!booking) {
      throw AppError.notFound('Booking task not found');
    }

    assertCanTransition(booking.status, newState);

    const updated = await tx.bookingTask.updateMany({
      where: { id: bookingTaskId, status: booking.status },
      data: {
        status: newState,
        ...(extras.startedAt !== undefined ? { startedAt: extras.startedAt } : {}),
        ...(extras.completedAt !== undefined ? { completedAt: extras.completedAt } : {}),
        ...(extras.failedAt !== undefined ? { failedAt: extras.failedAt } : {}),
        ...(extras.failureCode !== undefined ? { failureCode: extras.failureCode } : {}),
        ...(extras.failureReason !== undefined ? { failureReason: extras.failureReason } : {}),
        ...(extras.retryCount !== undefined ? { retryCount: extras.retryCount } : {}),
        ...(extras.lastAttemptAt !== undefined ? { lastAttemptAt: extras.lastAttemptAt } : {}),
        ...(extras.bookingReference !== undefined ? { bookingReference: extras.bookingReference } : {}),
        ...(extras.queueJobId !== undefined ? { queueJobId: extras.queueJobId } : {}),
        ...(extras.cancellationRequested !== undefined
          ? { cancellationRequested: extras.cancellationRequested }
          : {}),
        ...(extras.actionRequired !== undefined ? { actionRequired: extras.actionRequired } : {}),
        ...(extras.actionRequiredType !== undefined ? { actionRequiredType: extras.actionRequiredType } : {}),
        ...(extras.actionRequiredMessage !== undefined
          ? { actionRequiredMessage: extras.actionRequiredMessage }
          : {}),
        ...(extras.currentStage !== undefined ? { currentStage: extras.currentStage } : {}),
        ...(extras.providerStatus !== undefined ? { providerStatus: extras.providerStatus } : {}),
        ...(extras.artifactId !== undefined ? { artifactId: extras.artifactId } : {}),
      },
    });

    if (updated.count !== 1) {
      throw AppError.conflict('Booking state changed concurrently');
    }

    const mapping = STEP_BY_STATE[newState];
    await tx.executionLog.create({
      data: {
        bookingTaskId,
        step: mapping.step,
        status: mapping.status,
        message: extras.message ?? mapping.message,
        ...(extras.metadata !== undefined ? { metadata: extras.metadata } : {}),
      },
    });

    const next = await tx.bookingTask.findUniqueOrThrow({
      where: { id: bookingTaskId },
      include: { passengers: { include: { passenger: true } } },
    });
    return { next, from: booking.status, step: mapping.step };
  }, { timeout: 20_000, maxWait: 10_000 });

  logger.info('Booking state transitioned', {
    service: 'scheduler',
    bookingTaskId,
    event: result.step,
    status: newState,
    from: result.from,
  });

  return result.next;
}
