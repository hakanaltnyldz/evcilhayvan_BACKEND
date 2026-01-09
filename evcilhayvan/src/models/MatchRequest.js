import mongoose from "mongoose";

const { Schema } = mongoose;
const MATCH_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

const matchRequestSchema = new Schema(
  {
    advertId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
      index: true,
    },
    fromAdvertId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: false,
      index: true,
    },
    advertType: {
      type: String,
      enum: ["adoption", "mating"],
      default: "mating",
      index: true,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    note: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      default: "pending",
      index: true,
    },
    // Legacy fields are kept for smooth migration; pre-validate hook copies them
    requester: { type: Schema.Types.ObjectId, ref: "User", select: false },
    requesterPet: { type: Schema.Types.ObjectId, ref: "Pet", select: false },
    targetPet: { type: Schema.Types.ObjectId, ref: "Pet", select: false },
    targetOwner: { type: Schema.Types.ObjectId, ref: "User", select: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        if (ret.advertId) ret.advertId = ret.advertId.toString();
        if (ret.fromAdvertId) ret.fromAdvertId = ret.fromAdvertId.toString();
        ret.targetAdvertId = ret.advertId;
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

matchRequestSchema.index(
  { fromUserId: 1, advertId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);
matchRequestSchema.index({ toUserId: 1, status: 1 });

matchRequestSchema.pre("validate", function mapLegacyFields(next) {
  if (!this.fromUserId && this.requester) this.fromUserId = this.requester;
  if (!this.toUserId && this.targetOwner) this.toUserId = this.targetOwner;
  if (!this.advertId && this.targetPet) this.advertId = this.targetPet;
  if (!this.fromAdvertId && this.requesterPet) this.fromAdvertId = this.requesterPet;
  if (!this.requesterPet && this.fromAdvertId) this.requesterPet = this.fromAdvertId;
  if (!this.advertType) this.advertType = "mating";

  if (this.status === "matched") this.status = "accepted";
  if (this.status === "declined") this.status = "rejected";

  next();
});

matchRequestSchema.virtual("targetAdvertId")
  .get(function getTargetAdvertId() {
    return this.advertId;
  })
  .set(function setTargetAdvertId(value) {
    this.advertId = value;
  });

export default mongoose.model("MatchRequest", matchRequestSchema);
