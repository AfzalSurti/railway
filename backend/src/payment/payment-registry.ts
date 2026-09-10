import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { MockPaymentProvider } from './mock-payment-provider';
import { PaymentProvider } from './payment-provider';

const registry = new Map<string, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider): void {
  registry.set(provider.getName().toUpperCase(), provider);
}

registerPaymentProvider(new MockPaymentProvider());

export function getPaymentProvider(name: string = env.PAYMENT_PROVIDER): PaymentProvider {
  const provider = registry.get(name.toUpperCase());
  if (!provider) {
    throw AppError.badRequest(`Unknown payment provider: ${name}`);
  }
  return provider;
}

export function listPaymentProviders(): string[] {
  return [...registry.keys()];
}
