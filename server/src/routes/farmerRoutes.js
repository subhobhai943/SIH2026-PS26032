import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireFarmer } from '../middleware/auth.js';
import * as farmerController from '../controllers/farmerController.js';

const router = Router();

// OTP endpoints get their own tight limiter to blunt SMS-bombing abuse.
const otpLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

router.post('/otp/request', otpLimiter, farmerController.requestOtp);
router.post('/otp/verify', otpLimiter, farmerController.verifyOtp);
router.post('/firebase/verify', otpLimiter, farmerController.verifyFirebase);

router.get('/me', requireFarmer, farmerController.getProfile);
router.put('/me', requireFarmer, farmerController.updateProfile);
router.put('/me/push-token', requireFarmer, farmerController.registerPushToken);

export default router;
