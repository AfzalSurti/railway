import { PaymentIntent, PaymentResult } from './payment.types';

/**
 * Payment provider abstraction (Phase 5.4). The booking engine only ever talks
 * to PaymentService, never to a concrete provider. A real implementation would
 * use a provider-hosted / tokenized flow — this interface never accepts raw
 * card numbers, CVV, UPI PIN, or OTP.
 */
export interface PaymentProvider {
  getName(): string;
  createPaymentRequest(intent: PaymentIntent): Promise<PaymentResult>;
  getPaymentStatus(providerRef: string): Promise<PaymentResult>;
  /** Called after the human has authorized the payment out of band. */
  confirmPayment(providerRef: string): Promise<PaymentResult>;
  cancelPayment(providerRef: string): Promise<PaymentResult>;
}
