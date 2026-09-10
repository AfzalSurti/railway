import { env, MockExecutorOutcome } from '../../config/env';
import { ProviderCapability } from '../provider-capabilities';
import { BaseTravelProvider } from '../base/base-travel-provider';
import { ProviderContext } from '../base/provider-context';
import { BookingRequest } from '../base/travel-provider';
import {
  ProviderAuthenticationError,
  ProviderBookingRejectedError,
  ProviderCaptchaError,
  ProviderOtpRequiredError,
  ProviderPaymentRequiredError,
  ProviderPriceChangedError,
  ProviderTicketDownloadError,
  ProviderTimeoutError,
  ProviderUnavailableError,
  ProviderUnknownResultError,
} from '../provider-errors';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingPreparationResult,
  BookingResult,
  BookingStatusQuery,
  BookingStatusResult,
  CancellationResult,
  JourneyOption,
  ProviderHealthStatus,
  SearchRequest,
  SearchResult,
  ServiceType,
  TicketDownloadResult,
} from '../provider.types';
import { sleep } from '../../utils/time';

const ALLOWED_OUTCOMES: MockExecutorOutcome[] = [
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
];

function resolveOutcome(stored: string | null | undefined): MockExecutorOutcome {
  if (env.NODE_ENV === 'production') {
    return 'SUCCESS';
  }
  if (stored && ALLOWED_OUTCOMES.includes(stored as MockExecutorOutcome)) {
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

/** Minimal valid single-page PDF used for mock ticket downloads. */
const MOCK_TICKET_PDF_BASE64 =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAw' +
  'IG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8' +
  'PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCAyMDAgMjAwXT4+CmVuZG9iagp4' +
  'cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1' +
  'OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA0L1Jvb3QgMSAw' +
  'IFI+PgpzdGFydHhyZWYKMTkwCiUlRU9GCg==';

export class MockTrainProvider extends BaseTravelProvider {
  protected readonly name = 'MOCK';
  protected readonly serviceTypes: readonly ServiceType[] = ['TRAIN'];
  protected readonly capabilities: readonly ProviderCapability[] = [
    'SEARCH',
    'AVAILABILITY',
    'BOOKING',
    'CANCELLATION',
    'TICKET_DOWNLOAD',
    'STATUS_RECONCILIATION',
  ];

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

    return { found: true, journeys: [journeyFromContext(context, request)] };
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
      options: [{ class: travelClass, status: 'AVAILABLE', seats: 12 }],
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
      throw new ProviderPaymentRequiredError();
    }
    if (outcome === 'PAYMENT_FAILED') {
      return { status: 'FAILED', failureCode: 'PAYMENT_FAILED', message: 'Payment failed', retryable: false };
    }
    if (outcome === 'PRICE_CHANGED') {
      throw new ProviderPriceChangedError();
    }
    if (outcome === 'BOOKING_REJECTED') {
      throw new ProviderBookingRejectedError();
    }
    if (
      outcome === 'UNKNOWN_RESULT' ||
      outcome === 'UNKNOWN_RESULT_RECONCILE_CONFIRMED' ||
      outcome === 'UNKNOWN_RESULT_RECONCILE_FAILED'
    ) {
      throw new ProviderUnknownResultError();
    }
    if (outcome === 'UNKNOWN_ERROR') {
      return { status: 'FAILED', failureCode: 'UNKNOWN_ERROR', message: 'An unknown error occurred', retryable: false };
    }

    const bookingReference = `MOCK-${Math.floor(100000 + Math.random() * 900000)}`;
    return { status: 'SUCCESS', providerBookingReference: bookingReference, message: 'Booking confirmed' };
  }

  async getBookingStatus(
    query: BookingStatusQuery,
    context: ProviderContext,
  ): Promise<BookingStatusResult> {
    this.assertCapability('STATUS_RECONCILIATION');
    await this.pause();
    const outcome = resolveOutcome(context.mockOutcome);

    if (outcome === 'UNKNOWN_RESULT_RECONCILE_CONFIRMED') {
      return {
        state: 'CONFIRMED',
        providerBookingReference: query.providerBookingReference || `MOCK-${Math.floor(100000 + Math.random() * 900000)}`,
        message: 'Reconciliation found a confirmed booking on the provider.',
      };
    }
    if (outcome === 'UNKNOWN_RESULT_RECONCILE_FAILED') {
      return {
        state: 'FAILED',
        providerBookingReference: null,
        message: 'Reconciliation confirmed the booking did not go through.',
      };
    }
    return {
      state: 'UNKNOWN',
      providerBookingReference: null,
      message: 'Reconciliation could not determine the booking state.',
    };
  }

  async downloadTicket(
    providerBookingReference: string,
    context: ProviderContext,
  ): Promise<TicketDownloadResult> {
    this.assertCapability('TICKET_DOWNLOAD');
    await this.pause();
    const outcome = resolveOutcome(context.mockOutcome);
    if (outcome === 'TICKET_DOWNLOAD_FAILED') {
      throw new ProviderTicketDownloadError();
    }
    return {
      downloaded: true,
      fileName: `ticket-${providerBookingReference}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: MOCK_TICKET_PDF_BASE64,
      message: 'Mock ticket generated',
    };
  }

  async cancelBooking(
    _providerBookingReference: string,
    _context: ProviderContext,
  ): Promise<CancellationResult> {
    this.assertCapability('CANCELLATION');
    await this.pause();
    return { cancelled: true, message: 'Mock booking cancelled', refundInitiated: true };
  }

  private throwIfEarlyFailure(
    outcome: MockExecutorOutcome,
    phase: 'search' | 'availability' | 'prepare',
  ): void {
    if (outcome === 'AUTHENTICATION_REQUIRED' && phase === 'search') {
      throw new ProviderAuthenticationError();
    }
    if (outcome === 'OTP_REQUIRED' && phase === 'search') {
      throw new ProviderOtpRequiredError();
    }
    if (outcome === 'CAPTCHA_REQUIRED' && phase === 'search') {
      throw new ProviderCaptchaError();
    }
    if (outcome === 'WEBSITE_TIMEOUT' && phase === 'search') {
      throw new ProviderTimeoutError('Booking website timed out', 'SEARCH');
    }
    if (outcome === 'NETWORK_ERROR' && phase === 'search') {
      throw new ProviderUnavailableError('Network error while contacting provider', 'NETWORK_ERROR', true);
    }
    if (outcome === 'TEMPORARY_SERVER_ERROR' && phase === 'search') {
      throw new ProviderUnavailableError('Temporary provider server error', 'TEMPORARY_SERVER_ERROR', true);
    }
  }

  private async pause(): Promise<void> {
    const delayMs = env.NODE_ENV === 'test' ? 0 : env.MOCK_EXECUTOR_STEP_DELAY_MS;
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}
