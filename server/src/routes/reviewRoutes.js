import { Router } from 'express';
import * as reviewController from '../controllers/reviewController.js';

const router = Router();

router.get('/', reviewController.listAllReviews);
router.post('/', reviewController.createReview);
router.get('/farmers-list', reviewController.listFarmersForReview);
router.get('/farmer/:farmerId', reviewController.getFarmerReviews);
router.post('/:reviewId/helpful', reviewController.markHelpful);

export default router;
