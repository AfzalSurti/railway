import { Worker } from 'bullmq';
import { env } from '../config/env';
import { redisConnectionOptions } from '../queue/connection';
import { BOOKING_QUEUE_NAME, BookingExecutionJob, RETRY_BACKOFF_MS } from '../queue/queue.types';
import { bookingExecutionService } from '../services/bookingExecution.service';
import { logger } from '../utils/logger';

export function createBookingWorker(): Worker<BookingExecutionJob> {
  const backoffTable = env.NODE_ENV === 'test' ? [50, 100, 150] : [...RETRY_BACKOFF_MS];

  const worker = new Worker<BookingExecutionJob>(
    BOOKING_QUEUE_NAME,
    async (job) => bookingExecutionService.execute(job),
    {
      connection: { ...redisConnectionOptions, maxRetriesPerRequest: null },
      prefix: env.NODE_ENV === 'test' ? '{ata-test}' : '{ata}',
      concurrency: env.NODE_ENV === 'test' ? 1 : env.BOOKING_WORKER_CONCURRENCY,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return backoffTable[Math.max(0, attemptsMade - 1)] ?? backoffTable[backoffTable.length - 1];
        },
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info('Booking job completed', {
      service: 'worker',
      bookingTaskId: job.data.bookingTaskId,
      jobId: String(job.id),
      event: 'JOB_COMPLETED',
      status: 'COMPLETED',
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Booking job failed', {
      service: 'worker',
      bookingTaskId: job?.data.bookingTaskId,
      jobId: job ? String(job.id) : undefined,
      event: 'JOB_FAILED',
      status: 'FAILED',
      message: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('Booking worker error', {
      service: 'worker',
      event: 'WORKER_ERROR',
      message: error.message,
    });
  });

  return worker;
}
