import mongoose from "mongoose";

const SellerApplicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    companyTitle: { type: String, required: true, trim: true },
    taxNumber: { type: String, required: true, trim: true },
    taxOffice: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    contactInfo: { type: String, required: true, trim: true },
    iban: { type: String, required: true, trim: true },
    kvkkAccepted: { type: Boolean, required: true },
    contractAccepted: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rejectionReason: { type: String, trim: true },
  },
  {
    timestamps: true,
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

SellerApplicationSchema.index({ user: 1, status: 1 });

export default mongoose.model("SellerApplication", SellerApplicationSchema);
