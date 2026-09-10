import { env, MockExecutorOutcome } from '../../config/env';
import { ProviderContext } from '../base/provider-context';
import { BookingRequest, TravelProvider } from '../base/travel-provider';
import {
  ProviderAuthenticationError,
  ProviderCaptchaError,
  ProviderPaymentRequiredError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderUnknownResultError,
} from '../provider-errors';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingPreparationResult,
  BookingResult,
  JourneyOption,
  ProviderHealthStatus,
  SearchRequest,
  SearchResult,
  ServiceType,
} from '../provider.types';
import { sleep } from '../../utils/time';

function resolveOutcome(stored: string | null | undefined): MockExecutorOutcome {
  if (env.NODE_ENV === 'production') {
    return 'SUCCESS';
  }
  const allowed: MockExecutorOutcome[] = [
    'SUCCESS',
    'TRAIN_NOT_FOUND',
    'NO_SEATS',
    'WEBSITE_TIMEOUT',
    'NETWORK_ERROR',
    'TEMPORARY_SERVER_ERROR',
    'PAYMENT_FAILED',
    'PAYMENT_REQUIRED',
    'AUTHENTICATION_REQUIRED',
    'CAPTCHA_REQUIRED',
    'UNKNOWN_ERROR',
    'UNKNOWN_RESULT',
  ];
  if (stored && allowed.includes(stored as MockExecutorOutcome)) {
    return stored as MockExecutorOutcome;
  }
  return env.MOCK_EXECUTOR_OUTCOME;
}

function journeyFromContext(context: ProviderContext, request: SearchRequest): JourneyOption {
  const trainNumber = request.trainNumber ?? context.trainNumber ?? '20902';
  const trainName = trainNumber === '20902' ? 'Vande Bharat' : `Train ${trainNumber}`;
  return {
    providerTrainId: `mock-${trainNumber}-${request.source}-${request.destination}`,
    trainNumber,
    trainName,
    source: request.source,
    destination: request.destination,
    departureTime: request.departureTime ?? '15:51',
    arrivalTime: '18:15',
    classes: [request.serviceClass ?? context.travelClass ?? '3A', 'CC', '2A'],
  };
}

export class MockTrainProvider implements TravelProvider {
  getProviderName(): string {
    return 'MOCK';
  }

  supports(serviceType: ServiceType): boolean {
    return serviceType === 'TRAIN';
  }

  getHealth(): ProviderHealthStatus {
    return 'AVAILABLE';
  }

  getDescription(): string {
    return 'In-memory mock train provider. Does not open a browser or contact a real website.';
  }

  async search(request: SearchRequest, context: ProviderContext): Promise<SearchResult> {
    await this.pause();
    const outcome = resolveOutcome(context.mockOutcome);
    this.throwIfEarlyFailure(outcome, 'search');

    if (outcome === 'TRAIN_NOT_FOUND') {
      return { found: false, journeys: [], message: 'Train not found' };
    }

    const journey = journeyFromContext(context, request);
    return {
      found: true,
      journeys: [journey],
    };
  }

  async checkAvailability(
    request: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult> {
    await this.pause();
    const outcome = resolveOutcome(context.mockOutcome);
    this.throwIfEarlyFailure(outcome, 'availability');

    if (outcome === 'NO_SEATS') {
      return {
        available: false,
        options: [
          {
            class: request.travelClass ?? request.journey.classes[0] ?? '3A',
            status: 'NOT_AVAILABLE',
            seats: 0,
          },
        ],
        message: 'No seats available',
      };
    }

    const travelClass = request.travelClass ?? request.journey.classes[0] ?? '3A';
    return {
      available: true,
      options: [
        {
          class: travelClass,
          status: 'AVAILABLE',
          seats: 12,
        },
      ],
    };
  }

  async prepareBooking(request: BookingRequest): Promise<BookingPreparationResult> {
    await this.pause();
    const outcome = resolveOutcome(request.context.mockOutcome);
    this.throwIfEarlyFailure(outcome, 'prepare');
    return { ready: true, message: 'Passenger details accepted' };
  }

  async executeBooking(request: BookingRequest): Promise<BookingResult> {
    await this.pause();
    const outcome = resolveOutcome(request.context.mockOutcome);

    if (outcome === 'PAYMENT_REQUIRED') {
      throw new ProviderPaymentRequiredError('Payment authentication required');
    }
    if (outcome === 'PAYMENT_FAILED') {
      return {
        status: 'FAILED',
        failureCode: 'PAYMENT_FAILED',
        message: 'Payment failed',
        retryable: false,
      };
    }
    if (outcome === 'UNKNOWN_RESULT') {
      throw new ProviderUnknownResultError();
    }
    if (outcome === 'UNKNOWN_ERROR') {
      return {
        status: 'FAILED',
        failureCode: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
        retryable: false,
      };
    }

    const bookingReference = `MOCK-${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      status: 'SUCCESS',
      providerBookingReference: bookingReference,
      message: 'Booking confirmed',
    };
  }

  private throwIfEarlyFailure(outcome: MockExecutorOutcome, phase: 'search' | 'availability' | 'prepare'): void {
    if (outcome === 'AUTHENTICATION_REQUIRED' && (phase === 'search' || phase === 'prepare')) {
      if (phase === 'search') {
        throw new ProviderAuthenticationError('User authentication is required to continue.');
      }
    }
    if (outcome === 'CAPTCHA_REQUIRED' && phase === 'search') {
      throw new ProviderCaptchaError();
    }
    if (outcome === 'WEBSITE_TIMEOUT' && phase === 'search') {
      throw new ProviderTimeoutError('Booking website timed out');
    }
    if (outcome === 'NETWORK_ERROR' && phase === 'search') {
      throw new ProviderUnavailableError('Network error while contacting provider', 'NETWORK_ERROR', true);
    }
    if (outcome === 'TEMPORARY_SERVER_ERROR' && phase === 'search') {
      throw new ProviderUnavailableError(
        'Temporary provider server error',
        'TEMPORARY_SERVER_ERROR',
        true,
      );
    }
  }

  private async pause(): Promise<void> {
    const delayMs = env.NODE_ENV === 'test' ? 0 : env.MOCK_EXECUTOR_STEP_DELAY_MS;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}
