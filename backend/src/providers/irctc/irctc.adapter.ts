import { BrowserSession } from '../../browser/browser-session';
import { BrowserProviderAdapter } from '../adapters/browser-provider-adapter';
import { ProviderNotImplementedError } from '../provider-errors';
import {
  AvailabilityRequest,
  AvailabilityResult,
  BookingResult,
  ProviderPassenger,
  SearchRequest,
  SearchResult,
} from '../provider.types';

export class IrctcBrowserAdapter implements BrowserProviderAdapter {
  constructor(
    private readonly _session: BrowserSession,
    private readonly _baseUrl: string,
  ) {}

  async openProvider(): Promise<void> {
    throw new ProviderNotImplementedError('IRCTC browser adapter is not implemented.');
  }

  async search(_request: SearchRequest): Promise<SearchResult> {
    throw new ProviderNotImplementedError('IRCTC search selectors are not implemented.');
  }

  async checkAvailability(_request: AvailabilityRequest): Promise<AvailabilityResult> {
    throw new ProviderNotImplementedError('IRCTC availability selectors are not implemented.');
  }

  async selectJourney(_providerTrainId: string): Promise<void> {
    throw new ProviderNotImplementedError('IRCTC journey selection is not implemented.');
  }

  async enterPassengerDetails(_passengers: ProviderPassenger[]): Promise<void> {
    throw new ProviderNotImplementedError('IRCTC passenger entry is not implemented.');
  }

  async confirm(): Promise<BookingResult> {
    throw new ProviderNotImplementedError('IRCTC confirmation is not implemented.');
  }
}
