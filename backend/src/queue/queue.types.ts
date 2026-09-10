export type BookingExecutionJob = {
  bookingTaskId: string;
};

export const BOOKING_QUEUE_NAME = 'booking-execution';

export function bookingJobId(bookingTaskId: string): string {
  return `booking-${bookingTaskId}`;
}

export const RETRYABLE_FAILURE_CODES = [
  'WEBSITE_TIMEOUT',
  'NETWORK_ERROR',
  'TEMPORARY_SERVER_ERROR',
] as const;

export type RetryableFailureCode = (typeof RETRYABLE_FAILURE_CODES)[number];

/**
 * Codes that must never trigger an automatic retry, even if some other layer
 * marks the result retryable. An ambiguous or already-final booking must be
 * resolved by reconciliation or a human, not by re-running the booking.
 */
export const NON_RETRYABLE_FAILURE_CODES = [
  'UNKNOWN_RESULT',
  'UNKNOWN_ERROR',
  'BOOKING_NOT_CONFIRMED',
  'BOOKING_ALREADY_CONFIRMED',
  'BOOKING_REJECTED',
  'PRICE_CHANGED',
  'PAYMENT_FAILED',
  'PAYMENT_REQUIRED',
  'PAYMENT_UNKNOWN',
  'AUTHENTICATION_REQUIRED',
  'NO_SEATS',
  'TRAIN_NOT_FOUND',
  'PROVIDER_NOT_IMPLEMENTED',
  'PROVIDER_CAPABILITY_UNSUPPORTED',
  'UNSUPPORTED_PROVIDER',
] as const;

export function isNonRetryableFailureCode(code: string): boolean {
  return (NON_RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export function isRetryableFailureCode(code: string): boolean {
  if (isNonRetryableFailureCode(code)) {
    return false;
  }
  return (RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export const RETRY_BACKOFF_MS = [5_000, 15_000, 45_000] as const;
