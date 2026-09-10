import { HumanActionRequest, HumanActionStatus, HumanActionType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const humanActionRepository = {
  create(data: {
    bookingTaskId: string;
    type: HumanActionType;
    message: string;
    expiresAt: Date;
    metadata?: Prisma.InputJsonValue;
  }): Promise<HumanActionRequest> {
    return prisma.humanActionRequest.create({ data });
  },

  findById(id: string): Promise<HumanActionRequest | null> {
    return prisma.humanActionRequest.findUnique({ where: { id } });
  },

  listByBooking(bookingTaskId: string): Promise<HumanActionRequest[]> {
    return prisma.humanActionRequest.findMany({
      where: { bookingTaskId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findPendingByBooking(bookingTaskId: string): Promise<HumanActionRequest | null> {
    return prisma.humanActionRequest.findFirst({
      where: { bookingTaskId, status: HumanActionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
  },

  updateStatus(
    id: string,
    status: HumanActionStatus,
    resolvedAt: Date | null = null,
  ): Promise<HumanActionRequest> {
    return prisma.humanActionRequest.update({
      where: { id },
      data: { status, resolvedAt },
    });
  },

  /** Marks every still-pending request for a booking with the given status. */
  async closePendingForBooking(
    bookingTaskId: string,
    status: HumanActionStatus,
  ): Promise<number> {
    const result = await prisma.humanActionRequest.updateMany({
      where: { bookingTaskId, status: HumanActionStatus.PENDING },
      data: { status, resolvedAt: new Date() },
    });
    return result.count;
  },

  async expireOverdue(now = new Date()): Promise<number> {
    const result = await prisma.humanActionRequest.updateMany({
      where: { status: HumanActionStatus.PENDING, expiresAt: { lt: now } },
      data: { status: HumanActionStatus.EXPIRED, resolvedAt: now },
    });
    return result.count;
  },
};
