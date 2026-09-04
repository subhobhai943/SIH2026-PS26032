import { Router } from 'express';
import { uploadImage } from '../controllers/uploadController.js';
import { requireFarmer } from '../middleware/auth.js';

const router = Router();

// Image upload endpoint (protected by requireFarmer)
router.post('/', requireFarmer, uploadImage);

export default router;
