import { ProviderBookingExecutor, providerBookingExecutor } from './provider-booking-executor';
import { BookingExecutor, BookingExecutionContext, BookingExecutionResult } from './booking-executor';

export const MOCK_EXECUTION_STEPS = [
  'INITIALIZING',
  'OPENING_PROVIDER',
  'SEARCHING',
  'VERIFYING_JOURNEY',
  'CHECKING_AVAILABILITY',
  'SELECTING_JOURNEY',
  'SELECTING_CLASS',
  'ENTERING_PASSENGER_DETAILS',
  'CONFIRMING_BOOKING',
  'BOOKING_CONFIRMED',
] as const;

export class MockBookingExecutor implements BookingExecutor {
  constructor(private readonly inner: ProviderBookingExecutor = providerBookingExecutor) {}

  execute(bookingTaskId: string, context: BookingExecutionContext): Promise<BookingExecutionResult> {
    return this.inner.execute(bookingTaskId, context);
  }
}

export const mockBookingExecutor = new MockBookingExecutor();
