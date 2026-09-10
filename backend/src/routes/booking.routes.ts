import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { createBookingSchema, updateBookingSchema, rescheduleBookingSchema, runBookingSchema } from '../schemas/booking.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createBookingSchema), asyncHandler(bookingController.create));
router.get('/', asyncHandler(bookingController.list));
router.get('/:id', asyncHandler(bookingController.getById));
router.put('/:id', validateBody(updateBookingSchema), asyncHandler(bookingController.update));
router.delete('/:id', asyncHandler(bookingController.remove));
router.post('/:id/cancel', asyncHandler(bookingController.cancel));
router.put('/:id/reschedule', validateBody(rescheduleBookingSchema), asyncHandler(bookingController.reschedule));
router.post('/:id/run', validateBody(runBookingSchema), asyncHandler(bookingController.runNow));
router.post('/:id/resume', asyncHandler(bookingController.resume));
router.get('/:id/actions', asyncHandler(bookingController.listActions));
router.post('/:id/actions/:actionId/resolve', asyncHandler(bookingController.resolveAction));
router.get('/:id/payment', asyncHandler(bookingController.listPayments));
router.post('/:id/payment/authorize', asyncHandler(bookingController.authorizePayment));
router.get('/:id/logs', asyncHandler(bookingController.logs));

export default router;
