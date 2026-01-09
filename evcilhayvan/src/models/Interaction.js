// src/models/Interaction.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const interactionSchema = new Schema(
  {
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toPet: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    toPetOwner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "pass"],
      required: true,
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

interactionSchema.index({ fromUser: 1, toPet: 1 }, { unique: true });

export default mongoose.model("Interaction", interactionSchema);
