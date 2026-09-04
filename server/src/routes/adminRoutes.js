import { Router } from 'express';
import { requireStaff } from '../middleware/auth.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.post('/login', adminController.login);
router.get('/me', requireStaff(), adminController.me);

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

export default router;
