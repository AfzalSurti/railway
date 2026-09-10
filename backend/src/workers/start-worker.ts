import { createBookingWorker } from './booking.worker';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { closeBookingQueue } from '../queue/queues';
import { closeRedisConnections } from '../queue/connection';
import { closeLockClient } from '../queue/booking-lock';
import { logger } from '../utils/logger';
import { browserManager } from '../browser/browser-manager';
import '../providers';

async function start(): Promise<void> {
  await connectDatabase();
  const worker = createBookingWorker();
  logger.info('Booking worker started', { service: 'worker', event: 'WORKER_STARTED' });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Worker received ${signal}, shutting down`, { service: 'worker', event: 'WORKER_SHUTDOWN' });
    await worker.close();
    await browserManager.close();
    await closeBookingQueue();
    await closeLockClient();
    await closeRedisConnections();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.error('Failed to start booking worker', {
    service: 'worker',
    event: 'WORKER_START_FAILED',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
