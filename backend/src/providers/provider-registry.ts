import { TravelProvider } from './base/travel-provider';
import { ProviderDescriptor, ServiceType } from './provider.types';

function registryKey(serviceType: string, providerName: string): string {
  return `${serviceType.toUpperCase()}:${providerName.toUpperCase()}`;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, TravelProvider>();

  register(provider: TravelProvider): void {
    const name = provider.getProviderName().toUpperCase();
    for (const serviceType of ['TRAIN', 'BUS', 'FLIGHT'] as const) {
      if (provider.supports(serviceType)) {
        this.providers.set(registryKey(serviceType, name), provider);
      }
    }
  }

  get(serviceType: ServiceType | string, providerName: string): TravelProvider | undefined {
    return this.providers.get(registryKey(String(serviceType), providerName));
  }

  has(serviceType: ServiceType | string, providerName: string): boolean {
    return this.providers.has(registryKey(String(serviceType), providerName));
  }

  list(): TravelProvider[] {
    return [...new Set(this.providers.values())];
  }

  descriptors(): ProviderDescriptor[] {
    const rows: ProviderDescriptor[] = [];
    for (const [key, provider] of this.providers.entries()) {
      const [serviceType] = key.split(':');
      const health = provider.getHealth();
      rows.push({
        name: provider.getProviderName(),
        serviceType: serviceType as ProviderDescriptor['serviceType'],
        available: health === 'AVAILABLE',
        health,
        description: provider.getDescription(),
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || a.serviceType.localeCompare(b.serviceType));
  }

  clear(): void {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();
