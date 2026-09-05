import { Router } from 'express';
import { requireStaff } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.post('/login', authLimiter, adminController.login);
router.get('/me', requireStaff(), adminController.me);
router.get('/system-metrics', requireStaff(), adminController.getSystemMetrics);

router.post('/centers', requireStaff('admin'), adminController.createCenter);
router.put('/centers/:id', requireStaff('admin'), adminController.updateCenter);

router.post('/slots/generate', requireStaff(), adminController.generateSlots);
router.get('/slots', requireStaff(), adminController.listAllSlots);
router.patch('/slots/:id', requireStaff(), adminController.updateSlot);

router.get('/queue', requireStaff(), adminController.adminQueueBoard);
router.post('/queue/:id/check-in', requireStaff(), adminController.checkIn);
router.post('/queue/:id/call-next', requireStaff(), adminController.callNext);
router.patch('/queue/:id/status', requireStaff(), adminController.setQueueStatus);

router.get('/procurement/:queueEntryId', requireStaff(), adminController.getProcurementDetails);
router.patch('/procurement/:queueEntryId', requireStaff(), adminController.updateProcurementStage);
router.post('/procurement/:queueEntryId/pay-advance', requireStaff(), adminController.payAdvance);
router.post('/procurement/:queueEntryId/pay-balance', requireStaff(), adminController.payBalance);
router.post('/procurement/:queueEntryId/confirm-payment', requireStaff(), adminController.confirmPayment);
router.post('/procurement/:queueEntryId/generate-bill', requireStaff(), adminController.generateBill);

// Users / Farmers
router.get('/farmers', requireStaff(), adminController.listFarmers);
router.get('/farmers/:id', requireStaff(), adminController.getFarmerDossier);
router.patch('/farmers/:id', requireStaff('admin'), adminController.updateFarmer);

// Database Inspector & Telemetry (Restricted strictly to Administrators)
router.get('/database/overview', requireStaff('admin'), adminController.getDatabaseOverview);
router.get('/database/collection/:name', requireStaff('admin'), adminController.getCollectionData);
router.get('/database/collection/:name/:id', requireStaff('admin'), adminController.getDocumentDetails);

export default router;
