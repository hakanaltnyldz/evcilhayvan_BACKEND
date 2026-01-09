import { Router } from "express";
import multer from "multer";
import path from "path";
import { authRequired } from "../middlewares/auth.js";
import { storageService } from "../services/storageService.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

const router = Router();

const uploadDir = storageService.uploadDir;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname || "");
    cb(null, unique + ext);
  },
});

const imageFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image uploads are allowed"));
};

const videoFilter = (_req, file, cb) => {
  if (file.mimetype?.startsWith("video/")) return cb(null, true);
  cb(new Error("Only video uploads are allowed"));
};

const uploadImage = multer({ storage, fileFilter: imageFilter });
const uploadVideo = multer({ storage, fileFilter: videoFilter });

router.post("/images", authRequired(), uploadImage.single("file"), async (req, res) => {
  if (!req.file) return sendError(res, 400, "Dosya gerekli", "file_required");
  const publicPath = await storageService.save(req.file);
  return sendOk(res, 201, { url: publicPath, type: "image" });
});

router.post("/videos", authRequired(), uploadVideo.single("file"), async (req, res) => {
  if (!req.file) return sendError(res, 400, "Dosya gerekli", "file_required");
  const publicPath = await storageService.save(req.file);
  return sendOk(res, 201, { url: publicPath, type: "video" });
});

export default router;
