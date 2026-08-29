import { Router } from 'express';
import { requireFarmer } from '../middleware/auth.js';
import * as slotController from '../controllers/slotController.js';

const router = Router();

router.get('/centers', slotController.listCenters);
router.get('/centers/:id', slotController.getCenter);

router.get('/slots', slotController.listSlots);
router.get('/slots/availability', slotController.getAvailability);
router.post('/slots/book', requireFarmer, slotController.bookSlot);

router.get('/slots/bookings/me', requireFarmer, slotController.myBookings);
router.delete('/slots/bookings/:id', requireFarmer, slotController.cancelBooking);

export default router;
