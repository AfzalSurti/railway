export const PAYMENT_STATES = ['REQUIRED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export type PaymentIntent = {
  bookingTaskId: string;
  amount: number; // minor units
  currency: string;
  description: string;
};

export type PaymentResult = {
  state: PaymentState;
  providerRef: string | null;
  message: string;
};

/**
 * Allowed payment state transitions. A declined payment can be retried
 * (FAILED -> PROCESSING) but a settled or cancelled payment is terminal, so a
 * payment failure can never silently spawn a duplicate booking attempt.
 */
const ALLOWED: Record<PaymentState, PaymentState[]> = {
  REQUIRED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SUCCESS', 'FAILED', 'CANCELLED'],
  FAILED: ['PROCESSING', 'CANCELLED'],
  SUCCESS: [],
  CANCELLED: [],
};

export function canPaymentTransition(from: PaymentState, to: PaymentState): boolean {
  return from === to || ALLOWED[from].includes(to);
}
