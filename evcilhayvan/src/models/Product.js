import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    // Legacy alan
    title: { type: String, trim: true },
    // Yeni alan
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    photos: { type: [String], default: [] }, // legacy
    images: { type: [String], default: [] }, // yeni
    stock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        if ((!ret.images || ret.images.length === 0) && Array.isArray(ret.photos)) {
          ret.images = ret.photos;
        }
        if ((!ret.photos || ret.photos.length === 0) && Array.isArray(ret.images)) {
          ret.photos = ret.images;
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

ProductSchema.index({ title: "text", name: "text", description: "text" });

// Alanlar arasındaki eski/yeni isim farklarını eşleştir
ProductSchema.pre("validate", function (next) {
  if (!this.name && this.title) this.name = this.title;
  if (!this.title && this.name) this.title = this.name;
  if ((!this.images || this.images.length === 0) && Array.isArray(this.photos) && this.photos.length) {
    this.images = this.photos;
  }
  if ((!this.photos || this.photos.length === 0) && Array.isArray(this.images) && this.images.length) {
    this.photos = this.images;
  }
  next();
});

export default mongoose.model("Product", ProductSchema);
