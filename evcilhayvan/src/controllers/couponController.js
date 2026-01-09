// src/controllers/couponController.js

import Coupon from '../models/Coupon.js';
import Store from '../models/Store.js';

// Get all coupons for a seller
export const getSellerCoupons = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const { status } = req.query; // active, expired, all

    const query = { seller: sellerId };

    if (status === 'active') {
      query.isActive = true;
      query.validUntil = { $gte: new Date() };
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    }

    const coupons = await Coupon.find(query)
      .populate('applicableProducts', 'name title')
      .populate('applicableCategories', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error('Get seller coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Kuponlar yüklenirken hata oluştu',
      error: error.message,
    });
  }
};

// Create a coupon (sellers only)
export const createCoupon = async (req, res) => {
  try {
    const sellerId = req.user._id;
    const {
      code,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      validFrom,
      validUntil,
      usageLimit,
      perUserLimit,
      applicableProducts,
      applicableCategories,
    } = req.body;

    // Verify seller has a store
    const store = await Store.findOne({ owner: sellerId });
    if (!store) {
      return res.status(403).json({
        success: false,
        message: 'Kupon oluşturmak için mağazanız olmalı',
      });
    }

    // Validate required fields
    if (!code || !discountType || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: 'Gerekli alanları doldurun',
      });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Yüzde indirimi 1-100 arasında olmalıdır',
      });
    }

    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sabit indirim 0\'dan büyük olmalıdır',
      });
    }

    // Validate dates
    const from = new Date(validFrom);
    const until = new Date(validUntil);

    if (until <= from) {
      return res.status(400).json({
        success: false,
        message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır',
      });
    }

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase(),
    });

    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'Bu kupon kodu zaten kullanılıyor',
      });
    }

    // Create coupon
    const coupon = await Coupon.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minPurchaseAmount: minPurchaseAmount || 0,
      maxDiscountAmount,
      validFrom: from,
      validUntil: until,
      usageLimit,
      perUserLimit: perUserLimit || 1,
      seller: sellerId,
      store: store._id,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
    });

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate('applicableProducts', 'name title')
      .populate('applicableCategories', 'name');

    res.status(201).json({
      success: true,
      message: 'Kupon başarıyla oluşturuldu',
      coupon: populatedCoupon,
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon oluşturulurken hata oluştu',
      error: error.message,
    });
  }
};

// Update a coupon
export const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const sellerId = req.user._id;
    const updates = req.body;

    // Find coupon
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı',
      });
    }

    // Check ownership
    if (coupon.seller.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bu kuponu güncelleme yetkiniz yok',
      });
    }

    // Validate discount value if being updated
    if (updates.discountValue !== undefined) {
      const discountType = updates.discountType || coupon.discountType;

      if (discountType === 'percentage' && (updates.discountValue <= 0 || updates.discountValue > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Yüzde indirimi 1-100 arasında olmalıdır',
        });
      }

      if (discountType === 'fixed' && updates.discountValue <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Sabit indirim 0\'dan büyük olmalıdır',
        });
      }
    }

    // Validate dates if being updated
    if (updates.validFrom || updates.validUntil) {
      const from = updates.validFrom ? new Date(updates.validFrom) : coupon.validFrom;
      const until = updates.validUntil ? new Date(updates.validUntil) : coupon.validUntil;

      if (until <= from) {
        return res.status(400).json({
          success: false,
          message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır',
        });
      }
    }

    // Update coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('applicableProducts', 'name title')
      .populate('applicableCategories', 'name');

    res.json({
      success: true,
      message: 'Kupon başarıyla güncellendi',
      coupon: updatedCoupon,
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon güncellenirken hata oluştu',
      error: error.message,
    });
  }
};

// Delete a coupon
export const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const sellerId = req.user._id;

    // Find coupon
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı',
      });
    }

    // Check ownership
    if (coupon.seller.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bu kuponu silme yetkiniz yok',
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.json({
      success: true,
      message: 'Kupon başarıyla silindi',
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon silinirken hata oluştu',
      error: error.message,
    });
  }
};

// Validate a coupon code (for customers)
export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.params;
    const { amount, storeId } = req.query;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Tutar belirtilmelidir',
      });
    }

    // Find active coupon
    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı',
      });
    }

    // Check store restriction
    if (coupon.store && storeId && coupon.store.toString() !== storeId) {
      return res.status(400).json({
        success: false,
        message: 'Bu kupon bu mağaza için geçerli değil',
      });
    }

    // Validate coupon
    const validation = coupon.isValid();
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason,
      });
    }

    // Calculate discount
    const calculation = coupon.calculateDiscount(parseFloat(amount));

    if (calculation.error) {
      return res.status(400).json({
        success: false,
        message: calculation.error,
      });
    }

    res.json({
      success: true,
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      discount: calculation.discount,
      finalAmount: calculation.finalAmount,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon doğrulanırken hata oluştu',
      error: error.message,
    });
  }
};

// Toggle coupon active status
export const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const sellerId = req.user._id;

    // Find coupon
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Kupon bulunamadı',
      });
    }

    // Check ownership
    if (coupon.seller.toString() !== sellerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Bu kuponu güncelleme yetkiniz yok',
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: `Kupon ${coupon.isActive ? 'aktif' : 'pasif'} hale getirildi`,
      coupon,
    });
  } catch (error) {
    console.error('Toggle coupon status error:', error);
    res.status(500).json({
      success: false,
      message: 'Kupon durumu değiştirilirken hata oluştu',
      error: error.message,
    });
  }
};
