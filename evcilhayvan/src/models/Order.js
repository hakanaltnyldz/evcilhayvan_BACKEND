// src/models/Order.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  name: String,
  image: String,
});

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'debit_card', 'cash', 'transfer'],
      default: 'credit_card',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Index for user queries
orderSchema.index({ user: 1, createdAt: -1 });

// Index for status queries
orderSchema.index({ status: 1 });

// Method to check if user purchased a specific product
orderSchema.statics.hasPurchased = async function (userId, productId) {
  const order = await this.findOne({
    user: userId,
    'items.product': productId,
    paymentStatus: 'paid',
    status: { $in: ['processing', 'shipped', 'delivered'] },
  });
  return !!order;
};

// Ensure virtuals are included in JSON
orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

export default mongoose.model('Order', orderSchema);
