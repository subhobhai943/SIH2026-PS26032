import { Router } from 'express';
import { requireFarmer } from '../middleware/auth.js';
import * as queueController from '../controllers/queueController.js';

const router = Router();

router.get('/me/position', requireFarmer, queueController.myPosition);
router.get('/me/status/:bookingId', requireFarmer, queueController.myProcurementStatus);
router.get('/me/history', requireFarmer, queueController.myHistory);

router.get('/:centerId', queueController.getBoard);
router.get('/:centerId/stats', queueController.getStats);

export default router;
