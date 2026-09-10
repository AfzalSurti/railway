import { PaymentStatus, PaymentTransaction } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { bookingRepository } from '../repositories/booking.repository';
import { executionLogRepository } from '../repositories/executionLog.repository';
import { humanActionRepository } from '../repositories/humanAction.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { getPaymentProvider } from '../payment/payment-registry';
import { canPaymentTransition, PaymentState } from '../payment/payment.types';

export type PaymentView = {
  id: string;
  bookingTaskId: string;
  provider: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function toView(txn: PaymentTransaction): PaymentView {
  return {
    id: txn.id,
    bookingTaskId: txn.bookingTaskId,
    provider: txn.provider,
    amount: txn.amount,
    currency: txn.currency,
    status: txn.status,
    failureReason: txn.failureReason,
    createdAt: txn.createdAt.toISOString(),
    updatedAt: txn.updatedAt.toISOString(),
  };
}

async function requireOwnedBooking(userId: string, bookingId: string) {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking || booking.userId !== userId) {
    throw AppError.notFound('Booking task not found');
  }
  return booking;
}

function assertTransition(from: PaymentStatus, to: PaymentState): void {
  if (!canPaymentTransition(from as PaymentState, to)) {
    throw AppError.conflict(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export const paymentService = {
  /**
   * Called by the execution engine when a provider reports PAYMENT_REQUIRED.
   * Idempotent: if a non-terminal transaction already exists for the booking it
   * is returned as-is, so a paused/retried booking never opens a second charge.
   */
  async requirePayment(input: {
    bookingTaskId: string;
    amount?: number;
    currency?: string;
    description?: string;
  }): Promise<PaymentTransaction> {
    const existing = await paymentRepository.findActiveForBooking(input.bookingTaskId);
    if (existing) {
      return existing;
    }

    const provider = getPaymentProvider();
    const amount = input.amount ?? env.PAYMENT_MOCK_AMOUNT_MINOR;
    const currency = input.currency ?? env.PAYMENT_CURRENCY;

    const txn = await paymentRepository.create({
      bookingTaskId: input.bookingTaskId,
      provider: provider.getName(),
      amount,
      currency,
      status: PaymentStatus.REQUIRED,
    });

    const result = await provider.createPaymentRequest({
      bookingTaskId: input.bookingTaskId,
      amount,
      currency,
      description: input.description ?? 'Travel booking payment',
    });

    assertTransition(PaymentStatus.REQUIRED, result.state);
    const updated = await paymentRepository.update(txn.id, {
      status: result.state,
      providerRef: result.providerRef,
    });

    await executionLogRepository.create({
      bookingTaskId: input.bookingTaskId,
      step: 'PAYMENT_REQUIRED',
      status: 'WARNING',
      message: 'Payment authorization required',
      metadata: { paymentTransactionId: txn.id, amount, currency, provider: provider.getName() },
    });
    logger.info('Payment required', {
      service: 'executor',
      bookingTaskId: input.bookingTaskId,
      event: 'PAYMENT_REQUIRED',
    });
    return updated;
  },

  async listForBooking(userId: string, bookingId: string): Promise<PaymentView[]> {
    await requireOwnedBooking(userId, bookingId);
    const rows = await paymentRepository.listByBooking(bookingId);
    return rows.map(toView);
  },

  /**
   * Records that the human authorized the payment out of band. We only ask the
   * payment provider to confirm a previously created request — no card number,
   * CVV, UPI PIN, or OTP is accepted or stored here. On success the pending
   * PAYMENT human action is resolved; resuming the booking stays explicit.
   */
  async authorize(userId: string, bookingId: string): Promise<PaymentView> {
    await requireOwnedBooking(userId, bookingId);
    const txn = await paymentRepository.findActiveForBooking(bookingId);
    if (!txn) {
      throw AppError.conflict('There is no pending payment for this booking');
    }
    if (!txn.providerRef) {
      throw AppError.conflict('Payment request was not initialized with the provider');
    }

    const provider = getPaymentProvider(txn.provider);
    const result = await provider.confirmPayment(txn.providerRef);
    assertTransition(txn.status, result.state);

    const updated = await paymentRepository.update(txn.id, {
      status: result.state,
      ...(result.state === 'FAILED' ? { failureReason: result.message } : { failureReason: null }),
    });

    if (result.state === 'SUCCESS') {
      await humanActionRepository.closePendingForBooking(bookingId, 'RESOLVED');
      await executionLogRepository.create({
        bookingTaskId: bookingId,
        step: 'PAYMENT_COMPLETED',
        status: 'SUCCESS',
        message: 'Payment authorized by the user',
        metadata: { paymentTransactionId: txn.id },
      });
    } else {
      await executionLogRepository.create({
        bookingTaskId: bookingId,
        step: 'PAYMENT_FAILED',
        status: 'ERROR',
        message: result.message,
        metadata: { paymentTransactionId: txn.id },
      });
    }
    return toView(updated);
  },

  async cancel(userId: string, bookingId: string): Promise<PaymentView | null> {
    await requireOwnedBooking(userId, bookingId);
    const txn = await paymentRepository.findActiveForBooking(bookingId);
    if (!txn) {
      return null;
    }
    if (txn.providerRef) {
      await getPaymentProvider(txn.provider).cancelPayment(txn.providerRef);
    }
    assertTransition(txn.status, 'CANCELLED');
    const updated = await paymentRepository.update(txn.id, { status: PaymentStatus.CANCELLED });
    return toView(updated);
  },
};
