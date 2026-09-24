import { ProviderCapability } from '../provider-capabilities';
import { BaseTravelProvider } from '../base/base-travel-provider';
import { ProviderContext } from '../base/provider-context';
import { BookingRequest } from '../base/travel-provider';
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
import { generateOptions } from './mock-inventory';

/**
 * Generic in-memory provider for BUS and FLIGHT. It never opens a browser or
 * contacts a real site; inventory is generated deterministically per route/date.
 */
export abstract class MockInventoryProvider extends BaseTravelProvider {
  protected readonly name = 'MOCK';
  protected abstract readonly kind: ServiceType;
  protected readonly capabilities: readonly ProviderCapability[] = [
    'SEARCH',
    'AVAILABILITY',
    'BOOKING',
  ];

  protected get serviceTypes(): readonly ServiceType[] {
    return [this.kind];
  }

  getHealth(): ProviderHealthStatus {
    return 'AVAILABLE';
  }

  getDescription(): string {
    return `In-memory mock ${this.kind.toLowerCase()} provider with generated inventory. No real website is contacted.`;
  }

  async search(request: SearchRequest, _context: ProviderContext): Promise<SearchResult> {
    const journeys = generateOptions(this.kind, {
      source: request.source,
      destination: request.destination,
      journeyDate: request.journeyDate,
    });
    return { found: journeys.length > 0, journeys };
  }

  async checkAvailability(
    request: AvailabilityRequest,
    _context: ProviderContext,
  ): Promise<AvailabilityResult> {
    const options = (request.journey.classOptions ?? []).map((option) => ({
      class: option.name,
      status: option.seatsLeft > 0 ? ('AVAILABLE' as const) : ('NOT_AVAILABLE' as const),
      seats: option.seatsLeft,
    }));
    const wanted = request.travelClass?.toLowerCase();
    const chosen = wanted ? options.filter((option) => option.class.toLowerCase() === wanted) : options;
    const list = chosen.length > 0 ? chosen : options;
    const open = list.filter((option) => option.status === 'AVAILABLE');
    return {
      available: open.length > 0,
      options: open.length > 0 ? open : list,
      ...(open.length > 0 ? {} : { message: 'No seats available' }),
    };
  }

  async prepareBooking(_request: BookingRequest): Promise<BookingPreparationResult> {
    return { ready: true, message: 'Passenger details accepted' };
  }

  async executeBooking(_request: BookingRequest): Promise<BookingResult> {
    const reference = `MOCK-${this.kind.slice(0, 1)}${Math.floor(100000 + Math.random() * 900000)}`;
    return { status: 'SUCCESS', providerBookingReference: reference, message: 'Booking confirmed' };
  }
}
