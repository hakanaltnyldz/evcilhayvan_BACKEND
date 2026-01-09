import { Router } from "express";
import { body } from "express-validator";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  register,
  login,
  refreshToken,
  me,
  uploadAvatar,
  verifyEmail,
  forgotPassword,
  resetPassword,
  updateMe,
  getAllUsers,
  loginWithGoogle,
  loginWithFacebook,
} from "../controllers/authController.js";
import { authRequired } from "../middlewares/auth.js";
import { config } from "../config/config.js";

const router = Router();

/* ---------- Multer (Avatar Upload) ---------- */
const uploadDir = config.uploadDir || path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, "avatar-" + unique + ext);
  },
});
const upload = multer({ storage });
/* ------------------------------------------- */

// === KAYIT / GIRIS / SIFIRLAMA ===
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Isim gerekli"),
    body("email").isEmail().withMessage("Gecerli email gerekli"),
    body("password").isLength({ min: 6 }).withMessage("Sifre en az 6 karakter olmali"),
  ],
  register
);

router.post("/oauth/google", [body("idToken").notEmpty().withMessage("Google idToken gerekli")], loginWithGoogle);

router.post(
  "/oauth/facebook",
  [body("accessToken").notEmpty().withMessage("Facebook accessToken gerekli")],
  loginWithFacebook
);

router.post(
  "/verify-email",
  [
    body("email").isEmail().withMessage("Gecerli email gerekli"),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Dogrulama kodu 6 haneli olmali"),
  ],
  verifyEmail
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Gecerli email gerekli"),
    body("password").notEmpty().withMessage("Sifre gerekli"),
  ],
  login
);

router.post("/refresh", refreshToken);

router.post("/forgot-password", [body("email").isEmail().withMessage("Gecerli email gerekli")], forgotPassword);

router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Gecerli email gerekli"),
    body("code").isLength({ min: 6, max: 6 }).withMessage("Dogrulama kodu 6 haneli olmali"),
    body("newPassword").isLength({ min: 6 }).withMessage("Yeni sifre en az 6 karakter olmali"),
  ],
  resetPassword
);

// === GIRIS GEREKTIREN ISLEMLER ===
router.get("/me", authRequired(), me);

router.put(
  "/me",
  authRequired(),
  [body("name").optional().notEmpty().withMessage("Isim bos olamaz"), body("city").optional().trim(), body("about").optional().trim()],
  updateMe
);

router.post("/avatar", authRequired(), upload.single("avatar"), uploadAvatar);

router.get("/users", authRequired(), getAllUsers);

export default router;
