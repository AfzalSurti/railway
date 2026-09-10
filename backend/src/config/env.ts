import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mockOutcomeSchema = z.enum([
  'SUCCESS',
  'TRAIN_NOT_FOUND',
  'NO_SEATS',
  'WEBSITE_TIMEOUT',
  'NETWORK_ERROR',
  'TEMPORARY_SERVER_ERROR',
  'PAYMENT_FAILED',
  'PAYMENT_REQUIRED',
  'AUTHENTICATION_REQUIRED',
  'OTP_REQUIRED',
  'CAPTCHA_REQUIRED',
  'PRICE_CHANGED',
  'BOOKING_REJECTED',
  'TICKET_DOWNLOAD_FAILED',
  'UNKNOWN_ERROR',
  'UNKNOWN_RESULT',
  'UNKNOWN_RESULT_RECONCILE_CONFIRMED',
  'UNKNOWN_RESULT_RECONCILE_FAILED',
]);

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0') {
    return false;
  }
  return value;
}, z.boolean().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  MOCK_EXECUTOR_OUTCOME: mockOutcomeSchema.default('SUCCESS'),
  MOCK_EXECUTOR_STEP_DELAY_MS: z.coerce.number().int().min(0).default(400),
  BOOKING_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  BOOKING_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(1),
  BOOKING_EXECUTION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(120000),
  BROWSER_HEADLESS: booleanFromEnv,
  BROWSER_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  BROWSER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  BROWSER_ARTIFACT_DIR: z.string().min(1).default('./artifacts/browser'),
  BROWSER_ARTIFACT_RETENTION_DAYS: z.coerce.number().int().min(1).default(7),
  BROWSER_SAVE_TRACE_ON_SUCCESS: booleanFromEnv,
  BROWSER_TRACE: booleanFromEnv,
  IRCTC_BASE_URL: z.string().default(''),
  REDBUS_BASE_URL: z.string().default(''),
  PROVIDER_RECONCILE_ENABLED: booleanFromEnv,
  PAYMENT_PROVIDER: z.string().min(1).default('MOCK'),
  PAYMENT_CURRENCY: z.string().min(1).default('INR'),
  PAYMENT_MOCK_AMOUNT_MINOR: z.coerce.number().int().min(0).default(150000),
  TICKET_STORAGE_DIR: z.string().min(1).default('./artifacts/tickets'),
  TICKET_MAX_BYTES: z.coerce.number().int().min(1024).default(10 * 1024 * 1024),
  HUMAN_ACTION_TTL_MS: z.coerce.number().int().min(60_000).default(30 * 60 * 1000),
  METRICS_ENABLED: booleanFromEnv,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(details)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  BROWSER_HEADLESS: data.BROWSER_HEADLESS ?? data.NODE_ENV !== 'development',
  BROWSER_SAVE_TRACE_ON_SUCCESS: data.BROWSER_SAVE_TRACE_ON_SUCCESS ?? false,
  BROWSER_TRACE: data.BROWSER_TRACE ?? data.NODE_ENV !== 'production',
  PROVIDER_RECONCILE_ENABLED: data.PROVIDER_RECONCILE_ENABLED ?? true,
  METRICS_ENABLED: data.METRICS_ENABLED ?? true,
};

export type MockExecutorOutcome = z.infer<typeof mockOutcomeSchema>;
