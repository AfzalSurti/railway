import { ExecutionLog, ExecutionStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const executionLogRepository = {
  create(data: {
    bookingTaskId: string;
    step: string;
    status: ExecutionStatus;
    message: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<ExecutionLog> {
    return prisma.executionLog.create({ data });
  },

  createMany(
    data: Array<{
      bookingTaskId: string;
      step: string;
      status: ExecutionStatus;
      message: string;
      metadata?: Prisma.InputJsonValue;
    }>,
  ) {
    return prisma.executionLog.createMany({ data });
  },

  findByBookingTask(bookingTaskId: string): Promise<ExecutionLog[]> {
    return prisma.executionLog.findMany({
      where: { bookingTaskId },
      orderBy: { createdAt: 'asc' },
    });
  },
};
