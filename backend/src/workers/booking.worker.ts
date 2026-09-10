import { Worker } from 'bullmq';
import { env } from '../config/env';
import { redisConnectionOptions } from '../queue/connection';
import { BOOKING_QUEUE_NAME, BookingExecutionJob, RETRY_BACKOFF_MS } from '../queue/queue.types';
import { bookingExecutionService } from '../services/bookingExecution.service';
import { incr } from '../observability/metrics';
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
      // A booking execution can legitimately take a while (browser automation).
      // Give it a generous lock and recover a job at most once if a worker dies.
      lockDuration: Math.max(60_000, env.BOOKING_EXECUTION_TIMEOUT_MS + 30_000),
      stalledInterval: 30_000,
      maxStalledCount: 1,
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
    incr('worker_job_failures_total');
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
