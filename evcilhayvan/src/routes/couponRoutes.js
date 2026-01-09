// src/routes/couponRoutes.js

import express from 'express';
import * as couponController from '../controllers/couponController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Public route to validate a coupon
router.get('/coupons/:code/validate', couponController.validateCoupon);

// Protected routes
router.use(protect);

// Seller routes - manage coupons
router.get('/seller/coupons', couponController.getSellerCoupons);
router.post('/seller/coupons', couponController.createCoupon);
router.put('/seller/coupons/:couponId', couponController.updateCoupon);
router.delete('/seller/coupons/:couponId', couponController.deleteCoupon);
router.patch('/seller/coupons/:couponId/toggle', couponController.toggleCouponStatus);

export default router;
