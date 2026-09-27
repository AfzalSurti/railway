import { PaymentMethod } from '@prisma/client';
import { prisma } from '../config/database';

export const paymentMethodRepository = {
  create(data: {
    userId: string;
    label: string;
    brand: string;
    last4: string;
    autoPay: boolean;
  }): Promise<PaymentMethod> {
    return prisma.paymentMethod.create({ data });
  },

  listByUser(userId: string): Promise<PaymentMethod[]> {
    return prisma.paymentMethod.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  findById(id: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findUnique({ where: { id } });
  },

  /** At most one method per user has autoPay = true. */
  async clearAutoPay(userId: string): Promise<void> {
    await prisma.paymentMethod.updateMany({ where: { userId, autoPay: true }, data: { autoPay: false } });
  },

  setAutoPay(id: string, autoPay: boolean): Promise<PaymentMethod> {
    return prisma.paymentMethod.update({ where: { id }, data: { autoPay } });
  },

  findAutoPay(userId: string): Promise<PaymentMethod | null> {
    return prisma.paymentMethod.findFirst({ where: { userId, autoPay: true } });
  },

  delete(id: string): Promise<PaymentMethod> {
    return prisma.paymentMethod.delete({ where: { id } });
  },
};
