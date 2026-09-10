import { describe, expect, it } from 'vitest';
import { canPaymentTransition } from '../src/payment/payment.types';
import { MockPaymentProvider } from '../src/payment/mock-payment-provider';
import { getPaymentProvider, listPaymentProviders } from '../src/payment/payment-registry';

describe('payment state machine', () => {
  it('allows the forward path and retry after failure', () => {
    expect(canPaymentTransition('REQUIRED', 'PROCESSING')).toBe(true);
    expect(canPaymentTransition('PROCESSING', 'SUCCESS')).toBe(true);
    expect(canPaymentTransition('PROCESSING', 'FAILED')).toBe(true);
    expect(canPaymentTransition('FAILED', 'PROCESSING')).toBe(true);
  });

  it('treats SUCCESS and CANCELLED as terminal', () => {
    expect(canPaymentTransition('SUCCESS', 'PROCESSING')).toBe(false);
    expect(canPaymentTransition('SUCCESS', 'FAILED')).toBe(false);
    expect(canPaymentTransition('CANCELLED', 'PROCESSING')).toBe(false);
  });
});

describe('MockPaymentProvider', () => {
  it('creates a processing request then confirms it', async () => {
    const provider = new MockPaymentProvider();
    const created = await provider.createPaymentRequest({
      bookingTaskId: 'b1',
      amount: 150000,
      currency: 'INR',
      description: 'test',
    });
    expect(created.state).toBe('PROCESSING');
    expect(created.providerRef).toMatch(/^PAY-/);

    const confirmed = await provider.confirmPayment(created.providerRef!);
    expect(confirmed.state).toBe('SUCCESS');
  });

  it('simulates a declined authorization', async () => {
    const provider = new MockPaymentProvider();
    const declined = await provider.confirmPayment('PAY-xyz-fail');
    expect(declined.state).toBe('FAILED');
  });
});

describe('payment registry', () => {
  it('resolves the MOCK provider and rejects unknown names', () => {
    expect(getPaymentProvider('MOCK').getName()).toBe('MOCK');
    expect(listPaymentProviders()).toContain('MOCK');
    expect(() => getPaymentProvider('STRIPE')).toThrow();
  });
});
