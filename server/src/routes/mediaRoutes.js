import { Router } from 'express';
import { getMedia } from '../controllers/mediaController.js';

const router = Router();

// Match any subpath under /api/media/ (e.g. /api/media/backgrounds/bg.jpg, /api/media/crops/wheat.jpg)
router.get('/*', getMedia);

export default router;
