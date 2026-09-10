/// <reference types="vitest" />
process.env.NODE_ENV = 'test';
process.env.MOCK_EXECUTOR_STEP_DELAY_MS = process.env.MOCK_EXECUTOR_STEP_DELAY_MS ?? '0';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    globalTeardown: './tests/teardown.ts',
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/browser/**'],
    fileParallelism: false,
    testTimeout: 180000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      MOCK_EXECUTOR_STEP_DELAY_MS: '0',
      BOOKING_JOB_ATTEMPTS: '3',
    },
  },
});
