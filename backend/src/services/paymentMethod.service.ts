import { PaymentMethod } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { auditService } from '../observability/audit.service';
import { paymentMethodRepository } from '../repositories/paymentMethod.repository';

/**
 * Saved payment methods. The client is responsible for never sending — and
 * this API never accepts — a full card number, expiry, or CVV: only a label,
 * a card brand, and the last 4 digits (see schema.prisma PaymentMethod for
 * why). This is a display reference, not a charge token.
 */

export type PaymentMethodView = {
  id: string;
  label: string;
  brand: string;
  last4: string;
  autoPay: boolean;
  createdAt: string;
};

function toView(method: PaymentMethod): PaymentMethodView {
  return {
    id: method.id,
    label: method.label,
    brand: method.brand,
    last4: method.last4,
    autoPay: method.autoPay,
    createdAt: method.createdAt.toISOString(),
  };
}

async function requireOwned(userId: string, id: string): Promise<PaymentMethod> {
  const method = await paymentMethodRepository.findById(id);
  if (!method || method.userId !== userId) {
    throw AppError.notFound('Payment method not found');
  }
  return method;
}

export const paymentMethodService = {
  async list(userId: string): Promise<PaymentMethodView[]> {
    const rows = await paymentMethodRepository.listByUser(userId);
    return rows.map(toView);
  },

  async create(
    userId: string,
    input: { label: string; brand: string; last4: string; autoPay?: boolean },
  ): Promise<PaymentMethodView> {
    if (input.autoPay) {
      await paymentMethodRepository.clearAutoPay(userId);
    }
    const created = await paymentMethodRepository.create({
      userId,
      label: input.label,
      brand: input.brand,
      last4: input.last4,
      autoPay: Boolean(input.autoPay),
    });
    await auditService.record({
      action: 'PAYMENT_METHOD_ADDED',
      userId,
      metadata: { brand: input.brand, last4: input.last4, autoPay: Boolean(input.autoPay) },
    });
    return toView(created);
  },

  async setAutoPay(userId: string, id: string, autoPay: boolean): Promise<PaymentMethodView> {
    await requireOwned(userId, id);
    if (autoPay) {
      await paymentMethodRepository.clearAutoPay(userId);
    }
    const updated = await paymentMethodRepository.setAutoPay(id, autoPay);
    return toView(updated);
  },

  async remove(userId: string, id: string): Promise<void> {
    const method = await requireOwned(userId, id);
    await paymentMethodRepository.delete(id);
    await auditService.record({
      action: 'PAYMENT_METHOD_REMOVED',
      userId,
      metadata: { brand: method.brand, last4: method.last4 },
    });
  },
};
