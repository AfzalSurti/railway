import { Router } from 'express';
import { providerController } from '../controllers/provider.controller';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(providerController.list));
router.get('/:provider', asyncHandler(providerController.getByName));

export default router;
