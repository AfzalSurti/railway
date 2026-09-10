import { Router } from 'express';
import authRoutes from './auth.routes';
import passengerRoutes from './passenger.routes';
import bookingRoutes from './booking.routes';
import providerRoutes from './provider.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/passengers', passengerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/providers', providerRoutes);

export default router;
