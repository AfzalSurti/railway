import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

function redisOptionsFromUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}

export const redisConnectionOptions = redisOptionsFromUrl(env.REDIS_URL);

let healthClient: IORedis | null = null;

export function getRedisHealthClient(): IORedis {
  if (!healthClient) {
    healthClient = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    healthClient.on('error', (error) => {
      logger.error('Redis health client error', {
        service: 'api',
        event: 'REDIS_ERROR',
        message: error.message,
      });
    });
  }
  return healthClient;
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const client = getRedisHealthClient();
    if (client.status === 'wait' || client.status === 'end' || client.status === 'close') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedisConnections(): Promise<void> {
  if (healthClient) {
    healthClient.removeAllListeners();
    await healthClient.quit().catch(() => healthClient?.disconnect());
    healthClient = null;
  }
}
