import { Passenger } from '@prisma/client';
import { passengerRepository } from '../repositories/passenger.repository';
import { AppError } from '../utils/AppError';
import { CreatePassengerInput, UpdatePassengerInput } from '../schemas/passenger.schema';

export const passengerService = {
  async create(userId: string, input: CreatePassengerInput): Promise<Passenger> {
    return passengerRepository.create({ ...input, userId });
  },

  async list(userId: string): Promise<Passenger[]> {
    return passengerRepository.findByUser(userId);
  },

  async getById(userId: string, passengerId: string): Promise<Passenger> {
    const passenger = await passengerRepository.findById(passengerId);
    if (!passenger || passenger.userId !== userId) {
      throw AppError.notFound('Passenger not found');
    }
    return passenger;
  },

  async update(userId: string, passengerId: string, input: UpdatePassengerInput): Promise<Passenger> {
    await this.getById(userId, passengerId);
    return passengerRepository.update(passengerId, input);
  },

  async remove(userId: string, passengerId: string): Promise<void> {
    await this.getById(userId, passengerId);
    await passengerRepository.delete(passengerId);
  },

  async assertOwnedByUser(userId: string, passengerIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(passengerIds)];
    const passengers = await passengerRepository.findByIds(uniqueIds);
    if (passengers.length !== uniqueIds.length) {
      throw AppError.validation('One or more passengers were not found', [
        { path: 'passengerIds', message: 'Unknown passenger id' },
      ]);
    }
    const unauthorized = passengers.some((passenger) => passenger.userId !== userId);
    if (unauthorized) {
      throw AppError.forbidden('One or more passengers do not belong to the authenticated user');
    }
  },
};
