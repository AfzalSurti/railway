import { AttemptStatus, BookingAttempt, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const bookingAttemptRepository = {
  async nextAttemptNumber(bookingTaskId: string): Promise<number> {
    const aggregate = await prisma.bookingAttempt.aggregate({
      where: { bookingTaskId },
      _max: { attemptNumber: true },
    });
    return (aggregate._max.attemptNumber ?? 0) + 1;
  },

  create(data: Prisma.BookingAttemptUncheckedCreateInput): Promise<BookingAttempt> {
    return prisma.bookingAttempt.create({ data });
  },

  update(id: string, data: Prisma.BookingAttemptUncheckedUpdateInput): Promise<BookingAttempt> {
    return prisma.bookingAttempt.update({ where: { id }, data });
  },

  findActive(bookingTaskId: string): Promise<BookingAttempt | null> {
    return prisma.bookingAttempt.findFirst({
      where: { bookingTaskId, status: AttemptStatus.RUNNING, endedAt: null },
      orderBy: { attemptNumber: 'desc' },
    });
  },

  listByBooking(bookingTaskId: string): Promise<BookingAttempt[]> {
    return prisma.bookingAttempt.findMany({
      where: { bookingTaskId },
      orderBy: { attemptNumber: 'asc' },
    });
  },
};
