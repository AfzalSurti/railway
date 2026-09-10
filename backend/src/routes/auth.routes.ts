import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { requireAuth } from '../middleware/requireAuth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register),
);

router.post('/login', authRateLimiter, validateBody(loginSchema), asyncHandler(authController.login));

router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
