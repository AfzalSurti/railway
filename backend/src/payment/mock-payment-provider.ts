import { randomUUID } from 'crypto';
import { PaymentProvider } from './payment-provider';
import { PaymentIntent, PaymentResult, PaymentState } from './payment.types';

/**
 * In-memory mock payment provider. It simulates a provider-hosted flow:
 * createPaymentRequest -> PROCESSING (waiting for the human to authorize),
 * confirmPayment -> SUCCESS. No real money moves and no card data is handled.
 *
 * A providerRef ending in "-fail" simulates a declined authorization so the
 * failure path can be exercised deterministically in tests.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly states = new Map<string, PaymentState>();

  getName(): string {
    return 'MOCK';
  }

  async createPaymentRequest(intent: PaymentIntent): Promise<PaymentResult> {
    const providerRef = `PAY-${randomUUID()}`;
    this.states.set(providerRef, 'PROCESSING');
    return {
      state: 'PROCESSING',
      providerRef,
      message: `Mock payment of ${intent.amount} ${intent.currency} awaiting authorization`,
    };
  }

  async getPaymentStatus(providerRef: string): Promise<PaymentResult> {
    return {
      state: this.states.get(providerRef) ?? 'PROCESSING',
      providerRef,
      message: 'Mock payment status',
    };
  }

  async confirmPayment(providerRef: string): Promise<PaymentResult> {
    if (providerRef.endsWith('-fail')) {
      this.states.set(providerRef, 'FAILED');
      return { state: 'FAILED', providerRef, message: 'Mock payment was declined' };
    }
    this.states.set(providerRef, 'SUCCESS');
    return { state: 'SUCCESS', providerRef, message: 'Mock payment authorized' };
  }

  async cancelPayment(providerRef: string): Promise<PaymentResult> {
    this.states.set(providerRef, 'CANCELLED');
    return { state: 'CANCELLED', providerRef, message: 'Mock payment cancelled' };
  }
}
