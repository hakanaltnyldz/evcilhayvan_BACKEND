// models/User.js
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "seller"], default: "user" },
    city: { type: String, trim: true },
    about: { type: String, trim: true, maxlength: 500 },
    avatarUrl: { type: String, trim: true },
    fcmTokens: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    isSeller: { type: Boolean, default: false },
    refreshToken: { type: String, select: false },
    refreshTokenExpires: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.refreshToken;
        delete ret.refreshTokenExpires;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        return ret;
      },
    },
  }
);

UserSchema.methods.createVerificationToken = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.verificationToken = code;
  this.verificationTokenExpires = Date.now() + 10 * 60 * 1000;
  return code;
};

UserSchema.methods.createPasswordResetToken = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.passwordResetToken = code;
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return code;
};

export default mongoose.model("User", UserSchema);
