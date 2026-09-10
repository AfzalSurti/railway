import { env } from '../../config/env';
import { ProviderCapability } from '../provider-capabilities';
import { BaseTravelProvider } from '../base/base-travel-provider';
import { ProviderContext } from '../base/provider-context';
import { BookingRequest } from '../base/travel-provider';
import { ProviderNotImplementedError } from '../provider-errors';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingPreparationResult,
  BookingResult,
  ProviderHealthStatus,
  SearchRequest,
  SearchResult,
  ServiceType,
} from '../provider.types';

/**
 * IRCTC train provider skeleton. It declares the capabilities a real IRCTC
 * integration would eventually expose, but every operation intentionally
 * throws PROVIDER_NOT_IMPLEMENTED. No selectors, no login, no OTP, no payment.
 */
export class IrctcProvider extends BaseTravelProvider {
  protected readonly name = 'IRCTC';
  protected readonly serviceTypes: readonly ServiceType[] = ['TRAIN'];
  protected readonly capabilities: readonly ProviderCapability[] = [
    'SEARCH',
    'AVAILABILITY',
    'BOOKING',
    'AUTHENTICATION',
    'PAYMENT',
    'TICKET_DOWNLOAD',
    'CANCELLATION',
    'STATUS_RECONCILIATION',
  ];

  getHealth(): ProviderHealthStatus {
    return 'NOT_IMPLEMENTED';
  }

  getDescription(): string {
    return 'IRCTC train provider skeleton. Real booking, login, OTP, CAPTCHA, and payment are not implemented.';
  }

  getBaseUrl(): string {
    return env.IRCTC_BASE_URL;
  }

  async search(_request: SearchRequest, _context: ProviderContext): Promise<SearchResult> {
    this.assertNotImplemented('search');
  }

  async checkAvailability(
    _request: AvailabilityRequest,
    _context: ProviderContext,
  ): Promise<AvailabilityResult> {
    this.assertNotImplemented('availability');
  }

  async prepareBooking(_request: BookingRequest): Promise<BookingPreparationResult> {
    this.assertNotImplemented('prepareBooking');
  }

  async executeBooking(_request: BookingRequest): Promise<BookingResult> {
    this.assertNotImplemented('executeBooking');
  }

  private assertNotImplemented(operation: string): never {
    throw new ProviderNotImplementedError(
      `IRCTC ${operation} is not implemented. Real IRCTC booking is disabled.`,
    );
  }
}
