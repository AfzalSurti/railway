import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingResult,
  ProviderPassenger,
  SearchRequest,
  SearchResult,
} from '../provider.types';

export interface BrowserProviderAdapter {
  openProvider(): Promise<void>;
  search(request: SearchRequest): Promise<SearchResult>;
  checkAvailability(request: AvailabilityRequest): Promise<AvailabilityResult>;
  selectJourney(providerTrainId: string): Promise<void>;
  enterPassengerDetails(passengers: ProviderPassenger[]): Promise<void>;
  confirm(): Promise<BookingResult>;
}
