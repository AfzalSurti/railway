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
});
