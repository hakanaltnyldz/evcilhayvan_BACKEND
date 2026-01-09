import mongoose from "mongoose";
const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    contextType: {
      type: String,
      enum: ["MATCHING", "ADOPTION", null],
      default: null,
      index: true,
    },
    contextId: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      default: null,
      index: true,
    },
    relatedPet: {
      type: Schema.Types.ObjectId,
      ref: "Pet",
      required: false,
      default: null,
    },
    advertType: {
      type: String,
      enum: ["adoption", "mating", null],
      default: null,
      index: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
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

conversationSchema.index({ relatedPet: 1, participants: 1 });
conversationSchema.index({ contextType: 1, contextId: 1, participants: 1 });

export default mongoose.model("Conversation", conversationSchema);
