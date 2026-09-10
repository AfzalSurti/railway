import { BookingStatus, BookingTask, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export type BookingWithPassengers = Prisma.BookingTaskGetPayload<{
  include: {
    passengers: { include: { passenger: true } };
  };
}>;

export const bookingRepository = {
  create(data: {
    userId: string;
    serviceType: BookingTask['serviceType'];
    provider: string;
    source: string;
    destination: string;
    journeyDate: Date;
    scheduledAt: Date;
    trainNumber?: string;
    travelClass?: string;
    quota?: string;
    status: BookingStatus;
    passengerIds: string[];
  }): Promise<BookingWithPassengers> {
    return prisma.bookingTask.create({
      data: {
        userId: data.userId,
        serviceType: data.serviceType,
        provider: data.provider,
        source: data.source,
        destination: data.destination,
        journeyDate: data.journeyDate,
        scheduledAt: data.scheduledAt,
        trainNumber: data.trainNumber,
        travelClass: data.travelClass,
        quota: data.quota,
        status: data.status,
        passengers: {
          create: data.passengerIds.map((passengerId) => ({ passengerId })),
        },
      },
      include: { passengers: { include: { passenger: true } } },
    });
  },

  findByUser(userId: string): Promise<BookingWithPassengers[]> {
    return prisma.bookingTask.findMany({
      where: { userId },
      include: { passengers: { include: { passenger: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
  },

  findById(id: string): Promise<BookingWithPassengers | null> {
    return prisma.bookingTask.findUnique({
      where: { id },
      include: { passengers: { include: { passenger: true } } },
    });
  },

  update(
    id: string,
    data: Prisma.BookingTaskUncheckedUpdateInput,
    passengerIds?: string[],
  ): Promise<BookingWithPassengers> {
    return prisma.$transaction(async (tx) => {
      if (passengerIds) {
        await tx.bookingPassenger.deleteMany({ where: { bookingTaskId: id } });
        await tx.bookingPassenger.createMany({
          data: passengerIds.map((passengerId) => ({ bookingTaskId: id, passengerId })),
        });
      }
      return tx.bookingTask.update({
        where: { id },
        data,
        include: { passengers: { include: { passenger: true } } },
      });
    });
  },

  updateStatus(id: string, status: BookingStatus): Promise<BookingWithPassengers> {
    return prisma.bookingTask.update({
      where: { id },
      data: { status },
      include: { passengers: { include: { passenger: true } } },
    });
  },

  delete(id: string): Promise<BookingTask> {
    return prisma.bookingTask.delete({ where: { id } });
  },
};
