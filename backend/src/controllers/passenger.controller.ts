import { Request, Response } from 'express';
import { passengerService } from '../services/passenger.service';
import { sendSuccess } from '../utils/apiResponse';
import { getAuthenticatedUserId } from '../middleware/requireAuth';
import { CreatePassengerInput, UpdatePassengerInput } from '../schemas/passenger.schema';

export const passengerController = {
  async create(req: Request, res: Response): Promise<void> {
    const passenger = await passengerService.create(
      getAuthenticatedUserId(req),
      req.body as CreatePassengerInput,
    );
    sendSuccess(res, passenger, 'Passenger created', 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const passengers = await passengerService.list(getAuthenticatedUserId(req));
    sendSuccess(res, passengers);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const passenger = await passengerService.getById(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, passenger);
  },

  async update(req: Request, res: Response): Promise<void> {
    const passenger = await passengerService.update(
      getAuthenticatedUserId(req),
      req.params.id,
      req.body as UpdatePassengerInput,
    );
    sendSuccess(res, passenger, 'Passenger updated');
  },

  async remove(req: Request, res: Response): Promise<void> {
    await passengerService.remove(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, null, 'Passenger deleted');
  },
};
