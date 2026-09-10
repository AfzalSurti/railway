import { Queue, QueueEvents } from 'bullmq';
import { env } from '../config/env';
import { redisConnectionOptions } from './connection';
import { BOOKING_QUEUE_NAME, BookingExecutionJob, RETRY_BACKOFF_MS } from './queue.types';

const connection = { ...redisConnectionOptions, maxRetriesPerRequest: null };

let bookingQueue: Queue<BookingExecutionJob> | null = null;
let queueEvents: QueueEvents | null = null;

export function getBookingQueue(): Queue<BookingExecutionJob> {
  if (!bookingQueue) {
    bookingQueue = new Queue<BookingExecutionJob>(BOOKING_QUEUE_NAME, {
      connection,
      prefix: env.NODE_ENV === 'test' ? '{ata-test}' : '{ata}',
      defaultJobOptions: {
        attempts: env.BOOKING_JOB_ATTEMPTS,
        backoff: {
          type: 'custom',
          delay: RETRY_BACKOFF_MS[0],
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return bookingQueue;
}

export function getBookingQueueEvents(): QueueEvents {
  if (!queueEvents) {
    queueEvents = new QueueEvents(BOOKING_QUEUE_NAME, {
      connection,
      prefix: env.NODE_ENV === 'test' ? '{ata-test}' : '{ata}',
    });
  }
  return queueEvents;
}

export async function closeBookingQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  if (bookingQueue) {
    await bookingQueue.close();
    bookingQueue = null;
  }
}
