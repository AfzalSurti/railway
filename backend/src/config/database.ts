import { PrismaClient } from '@prisma/client';
import { env } from './env';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  transactionOptions: {
    maxWait: 10_000,
    timeout: 20_000,
  },
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
