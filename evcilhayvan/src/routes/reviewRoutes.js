// src/routes/reviewRoutes.js

import express from 'express';
import * as reviewController from '../controllers/reviewController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
// Get all reviews for a product
router.get('/products/:productId/reviews', reviewController.getProductReviews);

// Get review statistics for a product
router.get('/products/:productId/reviews/stats', reviewController.getReviewStats);

// Protected routes
router.use(protect);

// Check if user can review a product
router.get('/products/:productId/reviews/can-review', reviewController.canReview);

// Get user's review for a product
router.get('/products/:productId/reviews/my-review', reviewController.getUserReview);

// Create a review for a product
router.post('/products/:productId/reviews', reviewController.createReview);

// Update a review
router.put('/reviews/:reviewId', reviewController.updateReview);

// Delete a review
router.delete('/reviews/:reviewId', reviewController.deleteReview);

export default router;
