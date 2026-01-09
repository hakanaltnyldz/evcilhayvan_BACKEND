import mongoose from "mongoose";

const SellerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    storeName: { type: String, required: true, trim: true },
    storeDescription: { type: String, trim: true },
    storeLogo: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model("SellerProfile", SellerProfileSchema);
