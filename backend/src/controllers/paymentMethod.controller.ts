import { Request, Response } from 'express';
import { paymentMethodService } from '../services/paymentMethod.service';
import { getAuthenticatedUserId } from '../middleware/requireAuth';
import { CreatePaymentMethodInput, SetAutoPayInput } from '../schemas/paymentMethod.schema';
import { sendSuccess } from '../utils/apiResponse';

export const paymentMethodController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentMethodService.list(getAuthenticatedUserId(req)));
  },

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreatePaymentMethodInput;
    const created = await paymentMethodService.create(getAuthenticatedUserId(req), body);
    sendSuccess(res, created, 'Payment method saved', 201);
  },

  async setAutoPay(req: Request, res: Response): Promise<void> {
    const body = req.body as SetAutoPayInput;
    const updated = await paymentMethodService.setAutoPay(getAuthenticatedUserId(req), req.params.id, body.autoPay);
    sendSuccess(res, updated, body.autoPay ? 'Auto-pay enabled' : 'Auto-pay disabled');
  },

  async remove(req: Request, res: Response): Promise<void> {
    await paymentMethodService.remove(getAuthenticatedUserId(req), req.params.id);
    sendSuccess(res, null, 'Payment method removed');
  },
};
