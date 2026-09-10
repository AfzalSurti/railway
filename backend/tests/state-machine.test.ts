import { describe, expect, it } from 'vitest';
import { BookingStatus } from '@prisma/client';
import { assertCanTransition, canTransition } from '../src/execution/booking-state-machine';
import { AppError } from '../src/utils/AppError';

describe('Booking state machine', () => {
  it('allows documented transitions', () => {
    expect(canTransition(BookingStatus.DRAFT, BookingStatus.SCHEDULED)).toBe(true);
    expect(canTransition(BookingStatus.SCHEDULED, BookingStatus.QUEUED)).toBe(true);
    expect(canTransition(BookingStatus.SCHEDULED, BookingStatus.CANCELLED)).toBe(true);
    expect(canTransition(BookingStatus.QUEUED, BookingStatus.RUNNING)).toBe(true);
    expect(canTransition(BookingStatus.QUEUED, BookingStatus.CANCELLED)).toBe(true);
    expect(canTransition(BookingStatus.RUNNING, BookingStatus.COMPLETED)).toBe(true);
    expect(canTransition(BookingStatus.RUNNING, BookingStatus.FAILED)).toBe(true);
    expect(canTransition(BookingStatus.RUNNING, BookingStatus.CANCELLED)).toBe(true);
    expect(canTransition(BookingStatus.RUNNING, BookingStatus.QUEUED)).toBe(true);
    expect(canTransition(BookingStatus.AUTHENTICATION_REQUIRED, BookingStatus.QUEUED)).toBe(true);
    expect(canTransition(BookingStatus.PAYMENT_REQUIRED, BookingStatus.QUEUED)).toBe(true);
    expect(canTransition(BookingStatus.PAYMENT_REQUIRED, BookingStatus.FAILED)).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition(BookingStatus.COMPLETED, BookingStatus.RUNNING)).toBe(false);
    expect(canTransition(BookingStatus.FAILED, BookingStatus.RUNNING)).toBe(false);
    expect(canTransition(BookingStatus.CANCELLED, BookingStatus.SCHEDULED)).toBe(false);
    expect(() => assertCanTransition(BookingStatus.COMPLETED, BookingStatus.RUNNING)).toThrow(AppError);
  });

  it('supports UNKNOWN_RESULT as a held, resolvable state', () => {
    expect(canTransition(BookingStatus.RUNNING, BookingStatus.UNKNOWN_RESULT)).toBe(true);
    expect(canTransition(BookingStatus.UNKNOWN_RESULT, BookingStatus.COMPLETED)).toBe(true);
    expect(canTransition(BookingStatus.UNKNOWN_RESULT, BookingStatus.FAILED)).toBe(true);
    expect(canTransition(BookingStatus.UNKNOWN_RESULT, BookingStatus.QUEUED)).toBe(true);
    expect(canTransition(BookingStatus.UNKNOWN_RESULT, BookingStatus.CANCELLED)).toBe(true);
    // never straight back to RUNNING without an explicit human requeue
    expect(canTransition(BookingStatus.UNKNOWN_RESULT, BookingStatus.RUNNING)).toBe(false);
  });
});
