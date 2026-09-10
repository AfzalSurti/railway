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

export function isRetryableFailureCode(code: string): boolean {
  return (RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export const RETRY_BACKOFF_MS = [5_000, 15_000, 45_000] as const;
