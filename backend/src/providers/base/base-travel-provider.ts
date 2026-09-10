import { ProviderCapability, ProviderCapabilitySet } from '../provider-capabilities';
import { ProviderCapabilityError } from '../provider-errors';
import { ProviderHealthStatus, ServiceType } from '../provider.types';
import { ProviderContext } from './provider-context';
import {
  BookingRequest,
  TravelProvider,
} from './travel-provider';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingPreparationResult,
  BookingResult,
  SearchRequest,
  SearchResult,
} from '../provider.types';

/**
 * Shared base for every provider. Concrete providers declare the service types
 * and capabilities they support; capability gaps produce a typed
 * ProviderCapabilityError instead of a crash.
 */
export abstract class BaseTravelProvider implements TravelProvider {
  protected abstract readonly name: string;
  protected abstract readonly serviceTypes: readonly ServiceType[];
  protected abstract readonly capabilities: readonly ProviderCapability[];

  private capabilitySet: ProviderCapabilitySet | null = null;

  getProviderName(): string {
    return this.name;
  }

  supports(serviceType: ServiceType): boolean {
    return this.serviceTypes.includes(serviceType);
  }

  getCapabilities(): ProviderCapability[] {
    return this.getCapabilitySet().list();
  }

  hasCapability(capability: ProviderCapability): boolean {
    return this.getCapabilitySet().has(capability);
  }

  protected assertCapability(capability: ProviderCapability): void {
    if (!this.hasCapability(capability)) {
      throw new ProviderCapabilityError(this.name, capability);
    }
  }

  private getCapabilitySet(): ProviderCapabilitySet {
    if (!this.capabilitySet) {
      this.capabilitySet = new ProviderCapabilitySet(this.capabilities);
    }
    return this.capabilitySet;
  }

  abstract getHealth(): ProviderHealthStatus;
  abstract getDescription(): string;
  abstract search(request: SearchRequest, context: ProviderContext): Promise<SearchResult>;
  abstract checkAvailability(
    request: AvailabilityRequest,
    context: ProviderContext,
  ): Promise<AvailabilityResult>;
  abstract prepareBooking(request: BookingRequest): Promise<BookingPreparationResult>;
  abstract executeBooking(request: BookingRequest): Promise<BookingResult>;
}
