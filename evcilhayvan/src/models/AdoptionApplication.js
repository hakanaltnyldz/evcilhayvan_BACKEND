import mongoose from "mongoose";

const { Schema } = mongoose;

const APPLICATION_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"];

const adoptionApplicationSchema = new Schema(
  {
    adoptionListingId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    applicantUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: "PENDING",
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
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

adoptionApplicationSchema.index(
  { adoptionListingId: 1, applicantUserId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);
adoptionApplicationSchema.index({ applicantUserId: 1, status: 1 });

export default mongoose.model("AdoptionApplication", adoptionApplicationSchema);
