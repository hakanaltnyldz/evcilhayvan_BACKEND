import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

export function signToken(user) {
  const payload = { sub: user._id.toString(), role: user.role || "user", aud: "mobile" };
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token, options = {}) {
  return jwt.verify(token, config.jwt.secret, options);
}
