// routes/petRoutes.js

import { Router } from "express";
import { body, param } from "express-validator";
import path from "path";
import multer from "multer";

import { authRequired } from "../middlewares/auth.js";
import {
  createPet,
  myPets,
  updatePet,
  listPets,
  deletePet,
  getPet,
  uploadPetImage,
  uploadPetVideo,
  getPetFeed,
} from "../controllers/petController.js";
import { storageService } from "../services/storageService.js";

const router = Router();

const uploadDir = storageService.uploadDir || path.join(process.cwd(), "uploads");

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

router.get("/feed", authRequired(), getPetFeed);
router.get("/me", authRequired(), myPets);

router.post(
  "/",
  authRequired(),
  [
    body("name").notEmpty().withMessage("Isim gerekli"),
    body("species").isIn(["dog", "cat", "bird", "fish", "rodent", "other"]).withMessage("Gecersiz tur"),
    body("ageMonths").optional().isInt({ min: 0 }),
    body("photos").optional().isArray(),
    body("images").optional().isArray(),
    body("videos").optional().isArray(),
    body("advertType").optional().isIn(["adoption", "mating"]),
    body("location.coordinates").optional().isArray({ min: 2, max: 2 }),
  ],
  createPet
);

router.put(
  "/:id",
  authRequired(),
  [
    param("id").isMongoId(),
    body("species").optional().isIn(["dog", "cat", "bird", "fish", "rodent", "other"]),
    body("ageMonths").optional().isInt({ min: 0 }),
    body("advertType").optional().isIn(["adoption", "mating"]),
    body("location.coordinates").optional().isArray({ min: 2, max: 2 }),
  ],
  updatePet
);

router.delete("/:id", authRequired(), [param("id").isMongoId()], deletePet);

router.post("/:id/images", authRequired(), [param("id").isMongoId()], uploadImage.single("file"), uploadPetImage);
router.post("/:id/videos", authRequired(), [param("id").isMongoId()], uploadVideo.single("file"), uploadPetVideo);

router.get("/", listPets);
router.get("/:id", [param("id").isMongoId()], getPet);

export default router;
