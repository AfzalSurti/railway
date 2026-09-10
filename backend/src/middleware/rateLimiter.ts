import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => env.NODE_ENV === 'test' || Boolean(process.env.VITEST),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again later.',
      details: [],
    },
  },
});
