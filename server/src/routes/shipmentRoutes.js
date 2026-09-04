import { Router } from 'express';
import { requireStaff } from '../middleware/auth.js';
import * as shipmentController from '../controllers/shipmentController.js';

const router = Router();

// Public tracking
router.get('/track/:query', shipmentController.trackShipment);
router.get('/booking/:queueEntryId', shipmentController.getShipmentByBooking);
router.get('/recent', shipmentController.listRecentShipments);

// Staff / Admin logistics management
router.patch('/:id', requireStaff(), shipmentController.adminUpdateShipment);
router.post('/:id/checkpoint', requireStaff(), shipmentController.adminAddCheckpoint);

export default router;
