import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const LOCK_TTL_MS = 3 * 60 * 1000;

let lockClient: IORedis | null = null;

function getLockClient(): IORedis {
  if (!lockClient) {
    lockClient = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    lockClient.on('error', (error) => {
      logger.error('Redis lock client error', {
        service: 'worker',
        event: 'REDIS_ERROR',
        message: error.message,
      });
    });
  }
  return lockClient;
}

function lockKey(bookingTaskId: string): string {
  return `ata:booking-lock:${bookingTaskId}`;
}

export async function acquireBookingLock(bookingTaskId: string, jobId: string): Promise<boolean> {
  const result = await getLockClient().set(lockKey(bookingTaskId), jobId, 'PX', LOCK_TTL_MS, 'NX');
  return result === 'OK';
}

export async function releaseBookingLock(bookingTaskId: string, jobId: string): Promise<void> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  await getLockClient().eval(script, 1, lockKey(bookingTaskId), jobId);
}

export async function closeLockClient(): Promise<void> {
  if (lockClient) {
    lockClient.removeAllListeners();
    await lockClient.quit().catch(() => lockClient?.disconnect());
    lockClient = null;
  }
}
