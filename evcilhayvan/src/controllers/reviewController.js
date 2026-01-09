// src/controllers/reviewController.js

import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

// Get all reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name profilePicture')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Review.countDocuments({ product: productId });

    res.json({
      success: true,
      reviews,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Yorumlar yüklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Create a review
export const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, comment = '' } = req.body;
    const userId = req.user._id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz puan. 1-5 arası bir değer giriniz.',
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı',
      });
    }

    // Check if user has purchased the product
    const hasPurchased = await Order.hasPurchased(userId, productId);
    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: 'Bu ürünü satın almadığınız için yorum yapamazsınız',
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bu ürün için zaten yorum yaptınız',
      });
    }

    // Create review
    const review = await Review.create({
      product: productId,
      user: userId,
      rating: parseInt(rating),
      comment: comment.trim(),
      verifiedPurchase: true,
    });

    const populatedReview = await Review.findById(review._id).populate(
      'user',
      'name profilePicture'
    );

    res.status(201).json({
      success: true,
      message: 'Yorum başarıyla eklendi',
      review: populatedReview,
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Yorum eklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Yorum bulunamadı',
      });
    }

    // Check ownership
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bu yorumu güncelleme yetkiniz yok',
      });
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz puan. 1-5 arası bir değer giriniz.',
      });
    }

    // Update fields
    if (rating !== undefined) review.rating = parseInt(rating);
    if (comment !== undefined) review.comment = comment.trim();

    await review.save();

    const populatedReview = await Review.findById(review._id).populate(
      'user',
      'name profilePicture'
    );

    res.json({
      success: true,
      message: 'Yorum başarıyla güncellendi',
      review: populatedReview,
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Yorum güncellenirken hata oluştu',
      error: error.message,
    });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    // Find review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Yorum bulunamadı',
      });
    }

    // Check ownership
    if (review.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bu yorumu silme yetkiniz yok',
      });
    }

    await Review.findByIdAndDelete(reviewId);

    res.json({
      success: true,
      message: 'Yorum başarıyla silindi',
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Yorum silinirken hata oluştu',
      error: error.message,
    });
  }
};

// Get user's review for a product
export const getUserReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({
      product: productId,
      user: userId,
    }).populate('user', 'name profilePicture');

    if (!review) {
      return res.json({
        success: true,
        review: null,
      });
    }

    res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error('Get user review error:', error);
    res.status(500).json({
      success: false,
      message: 'Yorum yüklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Check if user can review a product
export const canReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user._id;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Ürün bulunamadı',
      });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });

    if (existingReview) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'already_reviewed',
        existingReview,
      });
    }

    // Check if purchased
    const hasPurchased = await Order.hasPurchased(userId, productId);
    if (!hasPurchased) {
      return res.json({
        success: true,
        canReview: false,
        reason: 'not_purchased',
      });
    }

    res.json({
      success: true,
      canReview: true,
    });
  } catch (error) {
    console.error('Can review error:', error);
    res.status(500).json({
      success: false,
      message: 'Kontrol yapılırken hata oluştu',
      error: error.message,
    });
  }
};

// Get review statistics for a product
export const getReviewStats = async (req, res) => {
  try {
    const { productId } = req.params;

    const stats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const total = await Review.countDocuments({ product: productId });
    const product = await Product.findById(productId);

    // Format stats
    const ratingDistribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    stats.forEach((stat) => {
      ratingDistribution[stat._id] = stat.count;
    });

    res.json({
      success: true,
      stats: {
        averageRating: product?.averageRating || 0,
        totalReviews: total,
        distribution: ratingDistribution,
      },
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      message: 'İstatistikler yüklenirken hata oluştu',
      error: error.message,
    });
  }
};
