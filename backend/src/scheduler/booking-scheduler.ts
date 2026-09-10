import { BookingStatus } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { delayUntilUtc, parseInstant } from '../utils/time';
import { bookingRepository } from '../repositories/booking.repository';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { getBookingQueue } from '../queue/queues';
import { bookingJobId, BookingExecutionJob } from '../queue/queue.types';

async function loadOwnedBooking(bookingTaskId: string, userId?: string) {
  const booking = await bookingRepository.findById(bookingTaskId);
  if (!booking) {
    throw AppError.notFound('Booking task not found');
  }
  if (userId && booking.userId !== userId) {
    throw AppError.notFound('Booking task not found');
  }
  return booking;
}

export const bookingScheduler = {
  async scheduleBooking(bookingTaskId: string, userId?: string): Promise<string> {
    const booking = await loadOwnedBooking(bookingTaskId, userId);
    if (booking.status !== BookingStatus.SCHEDULED) {
      throw AppError.conflict(`Cannot schedule a booking in ${booking.status} status`);
    }
    if (Number.isNaN(booking.scheduledAt.getTime())) {
      throw AppError.validation('scheduledAt must be a valid date');
    }

    const delay = delayUntilUtc(booking.scheduledAt);
    const jobId = bookingJobId(booking.id);

    try {
      const queue = getBookingQueue();
      const existing = await queue.getJob(jobId);
      if (existing) {
        await existing.remove();
      }

      const job = await queue.add(
        'execute-booking',
        { bookingTaskId: booking.id } satisfies BookingExecutionJob,
        {
          jobId,
          delay,
          attempts: env.BOOKING_JOB_ATTEMPTS,
        },
      );

      await bookingRepository.update(booking.id, { queueJobId: String(job.id) });
      await executionLogRepository.create({
        bookingTaskId: booking.id,
        step: 'BOOKING_SCHEDULED',
        status: 'INFO',
        message: 'Booking scheduled',
        metadata: { delayMs: delay, scheduledAt: booking.scheduledAt.toISOString() },
      });

      logger.info('Booking job scheduled', {
        service: 'scheduler',
        bookingTaskId: booking.id,
        jobId: String(job.id),
        event: 'JOB_SCHEDULED',
        status: booking.status,
        delayMs: delay,
      });

      return String(job.id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Failed to schedule booking job', {
        service: 'scheduler',
        bookingTaskId,
        event: 'JOB_SCHEDULE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AppError.serviceUnavailable('Booking scheduler is unavailable');
    }
  },

  async cancelScheduledBooking(bookingTaskId: string): Promise<void> {
    const booking = await bookingRepository.findById(bookingTaskId);
    if (!booking) {
      return;
    }
    const jobId = booking.queueJobId ?? bookingJobId(booking.id);
    try {
      const job = await getBookingQueue().getJob(jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      logger.warn('Failed to remove scheduled job', {
        service: 'scheduler',
        bookingTaskId,
        jobId,
        event: 'JOB_REMOVE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    await bookingRepository.update(bookingTaskId, { queueJobId: null });
  },

  async rescheduleBooking(bookingTaskId: string, scheduledAtRaw: string, userId?: string) {
    const booking = await loadOwnedBooking(bookingTaskId, userId);
    if (booking.status !== BookingStatus.SCHEDULED) {
      throw AppError.conflict('Only scheduled bookings can be rescheduled');
    }
    const scheduledAt = parseInstant(scheduledAtRaw);
    await this.cancelScheduledBooking(bookingTaskId);
    await bookingRepository.update(bookingTaskId, { scheduledAt });
    await this.scheduleBooking(bookingTaskId, userId);
    return bookingRepository.findById(bookingTaskId);
  },

  async enqueueImmediately(bookingTaskId: string, userId?: string): Promise<string> {
    const booking = await loadOwnedBooking(bookingTaskId, userId);
    if (booking.status !== BookingStatus.SCHEDULED && booking.status !== BookingStatus.QUEUED) {
      throw AppError.conflict(`Cannot run a booking in ${booking.status} status`);
    }

    await this.cancelScheduledBooking(bookingTaskId);

    try {
      const jobId = bookingJobId(booking.id);
      const job = await getBookingQueue().add(
        'execute-booking',
        { bookingTaskId: booking.id } satisfies BookingExecutionJob,
        { jobId, delay: 0, attempts: env.BOOKING_JOB_ATTEMPTS },
      );
      await bookingRepository.update(booking.id, { queueJobId: String(job.id) });
      logger.info('Booking queued for immediate run', {
        service: 'scheduler',
        bookingTaskId: booking.id,
        jobId: String(job.id),
        event: 'JOB_ENQUEUED',
      });
      return String(job.id);
    } catch (error) {
      logger.error('Failed to enqueue booking job', {
        service: 'scheduler',
        bookingTaskId,
        event: 'JOB_ENQUEUE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw AppError.serviceUnavailable('Booking scheduler is unavailable');
    }
  },
};
