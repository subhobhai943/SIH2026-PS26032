import { Router } from 'express';
import { requireStaff } from '../middleware/auth.js';
import * as operatorController from '../controllers/operatorController.js';

const router = Router();

// Restrict all operator routes to staff with 'admin' or 'operator' role
router.use(requireStaff('admin', 'operator'));

router.get('/logs', operatorController.getLogs);
router.post('/terminal', operatorController.executeCommand);
router.get('/system', operatorController.getSystemTelemetry);
router.post('/actions', operatorController.executeAction);

export default router;
