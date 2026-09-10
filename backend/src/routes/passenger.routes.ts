import { Router } from 'express';
import { passengerController } from '../controllers/passenger.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { createPassengerSchema, updatePassengerSchema } from '../schemas/passenger.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createPassengerSchema), asyncHandler(passengerController.create));
router.get('/', asyncHandler(passengerController.list));
router.get('/:id', asyncHandler(passengerController.getById));
router.put('/:id', validateBody(updatePassengerSchema), asyncHandler(passengerController.update));
router.delete('/:id', asyncHandler(passengerController.remove));

export default router;
