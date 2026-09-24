import { Router } from 'express';
import authRoutes from './auth.routes';
import passengerRoutes from './passenger.routes';
import bookingRoutes from './booking.routes';
import providerRoutes from './provider.routes';
import assistantRoutes from './assistant.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/passengers', passengerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/providers', providerRoutes);
router.use('/assistant', assistantRoutes);

export default router;
