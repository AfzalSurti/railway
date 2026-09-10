import { env } from '../../config/env';
import { ProviderContext } from '../base/provider-context';
import { BookingRequest, TravelProvider } from '../base/travel-provider';
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

export class IrctcProvider implements TravelProvider {
  getProviderName(): string {
    return 'IRCTC';
  }

  supports(serviceType: ServiceType): boolean {
    return serviceType === 'TRAIN';
  }

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
      `IRCTC ${operation} is not implemented. Real IRCTC booking is disabled in Phase 3.`,
    );
  }
}
