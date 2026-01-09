// src/models/Favorite.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const favoriteSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['pet', 'product', 'store'],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'itemType',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate favorites
favoriteSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true });

// Index for efficient queries
favoriteSchema.index({ user: 1, itemType: 1 });

// Virtual for referenced item
favoriteSchema.virtual('item', {
  refPath: 'itemType',
  localField: 'itemId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtuals are included in JSON
favoriteSchema.set('toJSON', { virtuals: true });
favoriteSchema.set('toObject', { virtuals: true });

export default mongoose.model('Favorite', favoriteSchema);
