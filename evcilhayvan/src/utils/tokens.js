import crypto from "crypto";
import { signToken } from "./jwt.js";

export async function issueTokens(user, { refreshTtlMs = 1000 * 60 * 60 * 24 * 30 } = {}) {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  user.refreshToken = refreshToken;
  user.refreshTokenExpires = new Date(Date.now() + refreshTtlMs);
  await user.save();

  return {
    accessToken: signToken(user),
    refreshToken,
  };
}
