import { Passenger, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const passengerRepository = {
  create(data: Prisma.PassengerUncheckedCreateInput): Promise<Passenger> {
    return prisma.passenger.create({ data });
  },

  findByUser(userId: string): Promise<Passenger[]> {
    return prisma.passenger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string): Promise<Passenger | null> {
    return prisma.passenger.findUnique({ where: { id } });
  },

  findByIds(ids: string[]): Promise<Passenger[]> {
    return prisma.passenger.findMany({ where: { id: { in: ids } } });
  },

  update(id: string, data: Prisma.PassengerUncheckedUpdateInput): Promise<Passenger> {
    return prisma.passenger.update({ where: { id }, data });
  },

  delete(id: string): Promise<Passenger> {
    return prisma.passenger.delete({ where: { id } });
  },
};
