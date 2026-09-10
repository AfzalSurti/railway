import { ProviderContext } from './provider-context';
import { ProviderCapability } from '../provider-capabilities';
import {
  AvailabilityOption,
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
  getCapabilities(): ProviderCapability[];
  hasCapability(capability: ProviderCapability): boolean;

  search(request: SearchRequest, context: ProviderContext): Promise<SearchResult>;
  checkAvailability(
    request: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult>;
  prepareBooking(request: BookingRequest): Promise<BookingPreparationResult>;
  executeBooking(request: BookingRequest): Promise<BookingResult>;

  /** Capability: STATUS_RECONCILIATION. Used to resolve UNKNOWN_RESULT safely. */
  getBookingStatus?(
    query: BookingStatusQuery,
    context: ProviderContext,
  ): Promise<BookingStatusResult>;
  /** Capability: TICKET_DOWNLOAD. */
  downloadTicket?(
    providerBookingReference: string,
    context: ProviderContext,
  ): Promise<TicketDownloadResult>;
  /** Capability: CANCELLATION. */
  cancelBooking?(
    providerBookingReference: string,
    context: ProviderContext,
  ): Promise<CancellationResult>;
}
