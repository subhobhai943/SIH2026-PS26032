import { Router } from 'express';
import { requireFarmer, requireStaff } from '../middleware/auth.js';
import * as shipmentController from '../controllers/shipmentController.js';

const router = Router();

// Farmer authenticated tracking routes
router.get('/my-shipments', requireFarmer, shipmentController.myShipments);
router.get('/track/:query', requireFarmer, shipmentController.trackShipment);
router.get('/booking/:queueEntryId', requireFarmer, shipmentController.getShipmentByBooking);

// Staff / Admin logistics management
router.patch('/:id', requireStaff(), shipmentController.adminUpdateShipment);
router.post('/:id/checkpoint', requireStaff(), shipmentController.adminAddCheckpoint);

export default router;
