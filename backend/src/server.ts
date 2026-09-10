import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeBookingQueue } from './queue/queues';
import { closeRedisConnections } from './queue/connection';
import { closeLockClient } from './queue/booking-lock';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  await connectDatabase();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT}`, {
      service: 'api',
      event: 'API_STARTED',
      env: env.NODE_ENV,
      docs: `/api/docs`,
    });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down`, { service: 'api', event: 'API_SHUTDOWN' });
    server.close(async () => {
      await closeBookingQueue();
      await closeLockClient();
      await closeRedisConnections();
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.error('Failed to start server', {
    service: 'api',
    event: 'API_START_FAILED',
    message: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
