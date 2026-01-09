import { Router } from "express";
import { body, param, query } from "express-validator";
import { authRequired } from "../middlewares/auth.js";
import { createPet, deletePet, getPet, listPets, myAdverts, updatePet } from "../controllers/petController.js";

const router = Router();

router.get("/", listPets);
router.get("/me", authRequired(), [query("type").optional().isIn(["adoption", "mating"])], myAdverts);
router.get("/:id", [param("id").isMongoId()], getPet);

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

router.patch(
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

export default router;
