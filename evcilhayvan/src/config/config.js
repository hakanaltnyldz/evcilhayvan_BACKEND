import path from "path";
import "dotenv/config";

const requiredVars = ["JWT_SECRET", "MONGO_URI"];
const missing = requiredVars.filter((key) => !process.env[key]);

if (missing.length && process.env.NODE_ENV !== "test") {
  console.warn(`[config] Missing environment variables: ${missing.join(", ")}`);
}

const corsOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/evcilhayvan",
  jwt: {
    secret: process.env.JWT_SECRET || "changeme",
    expiresIn: process.env.JWT_EXPIRES || "7d",
  },
  corsOrigins: corsOrigins.length ? corsOrigins : ["*"],
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
  sendgridKey: process.env.SENDGRID_API_KEY || "",
  senderEmail: process.env.SENDER_EMAIL || "",
};
