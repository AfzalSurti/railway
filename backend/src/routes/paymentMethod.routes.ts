import { Router } from 'express';
import { paymentMethodController } from '../controllers/paymentMethod.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { createPaymentMethodSchema, setAutoPaySchema } from '../schemas/paymentMethod.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(paymentMethodController.list));
router.post('/', validateBody(createPaymentMethodSchema), asyncHandler(paymentMethodController.create));
router.patch('/:id/auto-pay', validateBody(setAutoPaySchema), asyncHandler(paymentMethodController.setAutoPay));
router.delete('/:id', asyncHandler(paymentMethodController.remove));

export default router;
