// src/models/Coupon.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const couponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Only for seller-specific coupons
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      index: true,
    },
    // Product restrictions
    applicableProducts: [{
      type: Schema.Types.ObjectId,
      ref: 'Product',
    }],
    // Category restrictions
    applicableCategories: [{
      type: Schema.Types.ObjectId,
      ref: 'Category',
    }],
  },
  {
    timestamps: true,
  }
);

// Index for code lookups
couponSchema.index({ code: 1, isActive: 1 });

// Index for seller queries
couponSchema.index({ seller: 1, isActive: 1 });

// Method to check if coupon is valid
couponSchema.methods.isValid = function () {
  const now = new Date();

  if (!this.isActive) return { valid: false, reason: 'Kupon aktif değil' };
  if (now < this.validFrom) return { valid: false, reason: 'Kupon henüz geçerli değil' };
  if (now > this.validUntil) return { valid: false, reason: 'Kupon süresi dolmuş' };
  if (this.usageLimit && this.usageCount >= this.usageLimit) {
    return { valid: false, reason: 'Kupon kullanım limiti dolmuş' };
  }

  return { valid: true };
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function (amount) {
  if (amount < this.minPurchaseAmount) {
    return {
      discount: 0,
      error: `Minimum ${this.minPurchaseAmount} TL alışveriş gereklidir`,
    };
  }

  let discount = 0;

  if (this.discountType === 'percentage') {
    discount = (amount * this.discountValue) / 100;

    // Apply max discount limit if exists
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  } else if (this.discountType === 'fixed') {
    discount = this.discountValue;
  }

  // Discount cannot be more than the total amount
  discount = Math.min(discount, amount);

  return {
    discount: Math.round(discount * 100) / 100,
    finalAmount: Math.round((amount - discount) * 100) / 100,
  };
};

// Static method to find valid coupon by code
couponSchema.statics.findValidCoupon = async function (code, sellerId = null) {
  const query = {
    code: code.toUpperCase(),
    isActive: true,
  };

  if (sellerId) {
    query.seller = sellerId;
  }

  const coupon = await this.findOne(query);
  if (!coupon) return null;

  const validation = coupon.isValid();
  if (!validation.valid) return null;

  return coupon;
};

// Ensure virtuals are included in JSON
couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

export default mongoose.model('Coupon', couponSchema);
