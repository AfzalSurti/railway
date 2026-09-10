import { TravelProvider } from './base/travel-provider';
import { ProviderUnsupportedError } from './provider-errors';
import { providerRegistry, ProviderRegistry } from './provider-registry';
import { ProviderDescriptor, ServiceType } from './provider.types';

export class ProviderFactory {
  constructor(private readonly registry: ProviderRegistry = providerRegistry) {}

  isSupported(serviceType: ServiceType | string, providerName: string): boolean {
    return this.registry.has(serviceType, providerName);
  }

  get(serviceType: ServiceType | string, providerName: string): TravelProvider {
    const provider = this.registry.get(serviceType, providerName);
    if (!provider) {
      throw new ProviderUnsupportedError(String(serviceType).toUpperCase(), providerName.toUpperCase());
    }
    return provider;
  }

  list(): ProviderDescriptor[] {
    return this.registry.descriptors();
  }

  getMetadata(providerName: string): ProviderDescriptor[] {
    const name = providerName.toUpperCase();
    const matches = this.registry.descriptors().filter((item) => item.name.toUpperCase() === name);
    if (matches.length === 0) {
      throw new ProviderUnsupportedError('ANY', name);
    }
    return matches;
  }
}

export const providerFactory = new ProviderFactory();
