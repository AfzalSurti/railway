import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';
import { getAuthenticatedUserId } from '../middleware/requireAuth';
import { LoginInput, RegisterInput } from '../schemas/auth.schema';

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body as RegisterInput);
    sendSuccess(res, result, 'Registration successful', 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body as LoginInput);
    sendSuccess(res, result);
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getCurrentUser(getAuthenticatedUserId(req));
    sendSuccess(res, { user });
  },
};
