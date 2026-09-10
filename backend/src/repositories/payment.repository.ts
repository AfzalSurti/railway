import { PaymentStatus, PaymentTransaction, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const NON_TERMINAL: PaymentStatus[] = [PaymentStatus.REQUIRED, PaymentStatus.PROCESSING, PaymentStatus.FAILED];

export const paymentRepository = {
  create(data: {
    bookingTaskId: string;
    provider: string;
    amount: number;
    currency: string;
    status?: PaymentStatus;
    providerRef?: string;
  }): Promise<PaymentTransaction> {
    return prisma.paymentTransaction.create({ data });
  },

  findById(id: string): Promise<PaymentTransaction | null> {
    return prisma.paymentTransaction.findUnique({ where: { id } });
  },

  listByBooking(bookingTaskId: string): Promise<PaymentTransaction[]> {
    return prisma.paymentTransaction.findMany({
      where: { bookingTaskId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findActiveForBooking(bookingTaskId: string): Promise<PaymentTransaction | null> {
    return prisma.paymentTransaction.findFirst({
      where: { bookingTaskId, status: { in: NON_TERMINAL } },
      orderBy: { createdAt: 'desc' },
    });
  },

  update(
    id: string,
    data: Prisma.PaymentTransactionUncheckedUpdateInput,
  ): Promise<PaymentTransaction> {
    return prisma.paymentTransaction.update({ where: { id }, data });
  },
};
