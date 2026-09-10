import { Router } from 'express';
import { healthController } from '../controllers/health.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(healthController.live));
router.get('/db', asyncHandler(healthController.database));
router.get('/redis', asyncHandler(healthController.redis));

export default router;
