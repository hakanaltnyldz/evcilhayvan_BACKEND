// src/models/Review.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    // Reference to the order that allows this review
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    // Helpful count for future features
    helpfulCount: {
      type: Number,
      default: 0,
    },
    // Verified purchase badge
    verifiedPurchase: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate reviews for same product by same user
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Index for product queries
reviewSchema.index({ product: 1, createdAt: -1 });

// Virtual for formatted date
reviewSchema.virtual('formattedDate').get(function () {
  return this.createdAt.toLocaleDateString('tr-TR');
});

// Ensure virtuals are included in JSON
reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

// Method to update product average rating
reviewSchema.statics.updateProductRating = async function (productId) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const Product = mongoose.model('Product');

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      reviewCount: stats[0].reviewCount,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      averageRating: 0,
      reviewCount: 0,
    });
  }
};

// Update product rating after save
reviewSchema.post('save', async function () {
  await this.constructor.updateProductRating(this.product);
});

// Update product rating after remove
reviewSchema.post('remove', async function () {
  await this.constructor.updateProductRating(this.product);
});

// Update product rating after findOneAndDelete
reviewSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await this.model.updateProductRating(doc.product);
  }
});

export default mongoose.model('Review', reviewSchema);
