import { MockTrainProvider } from './mock/mock-train-provider';
import { IrctcProvider } from './irctc/irctc.provider';
import { providerRegistry } from './provider-registry';
import { providerFactory } from './provider.factory';

let bootstrapped = false;

export function registerProviders(): void {
  if (bootstrapped) {
    return;
  }
  providerRegistry.register(new MockTrainProvider());
  providerRegistry.register(new IrctcProvider());
  bootstrapped = true;
}

registerProviders();

export { providerFactory, providerRegistry };
export { ProviderFactory } from './provider.factory';
export { ProviderRegistry } from './provider-registry';
export { MockTrainProvider } from './mock/mock-train-provider';
export { IrctcProvider } from './irctc/irctc.provider';
export type { TravelProvider, BookingRequest } from './base/travel-provider';
export type { ProviderContext } from './base/provider-context';
export * from './provider.types';
export * from './provider-errors';
