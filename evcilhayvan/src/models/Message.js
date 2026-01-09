// src/models/Message.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["TEXT", "SYSTEM"],
      default: "TEXT",
      index: true,
    },
    readBy: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    deletedFor: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        if (ret.senderId) ret.senderId = ret.senderId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

messageSchema.pre("validate", function mapSender(next) {
  if (!this.senderId && this.sender) {
    this.senderId = this.sender;
  }
  if (!this.sender && this.senderId) {
    this.sender = this.senderId;
  }
  next();
});

export default mongoose.model("Message", messageSchema);
