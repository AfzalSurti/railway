import { beforeAll } from 'vitest';
import { env } from '../src/config/env';

beforeAll(() => {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run tests');
  }
});
