import { Router } from 'express';
import { assistantController } from '../controllers/assistant.controller';
import { assistantRateLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import { assistantSearchSchema } from '../schemas/assistant.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public on purpose: it only reads generic provider search results and touches no user data.
router.post('/search', assistantRateLimiter, validateBody(assistantSearchSchema), asyncHandler(assistantController.search));

export default router;
