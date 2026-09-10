import { ProviderContext } from './provider-context';
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
  AvailabilityOption,
} from '../provider.types';

export type BookingRequest = {
  context: ProviderContext;
  search: SearchRequest;
  journey: JourneyOption;
  availability: AvailabilityOption;
};

export interface TravelProvider {
  getProviderName(): string;
  supports(serviceType: ServiceType): boolean;
  getHealth(): ProviderHealthStatus;
  getDescription(): string;
  search(request: SearchRequest, context: ProviderContext): Promise<SearchResult>;
  checkAvailability(
    request: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult>;
  prepareBooking(request: BookingRequest): Promise<BookingPreparationResult>;
  executeBooking(request: BookingRequest): Promise<BookingResult>;
}
