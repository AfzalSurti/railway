import { Request, Response } from 'express';
import { providerService } from '../services/provider.service';
import { sendSuccess } from '../utils/apiResponse';

export const providerController = {
  async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, providerService.list());
  },

  async getByName(req: Request, res: Response): Promise<void> {
    sendSuccess(res, providerService.getByName(req.params.provider));
  },
};
