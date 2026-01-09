import { Router } from "express";
import { body, param } from "express-validator";
import { authRequired } from "../middlewares/auth.js";
import {
  acceptAdoptionApplication,
  createAdoptionApplication,
  getAdoptionApplicationsInbox,
  getAdoptionApplicationsSent,
  rejectAdoptionApplication,
} from "../controllers/adoptionApplicationController.js";

const router = Router();

router.use(authRequired());

router.post(
  "/",
  [body("adoptionListingId").isMongoId().withMessage("Gecersiz ilan ID")],
  createAdoptionApplication
);

router.get("/inbox", getAdoptionApplicationsInbox);
router.get("/sent", getAdoptionApplicationsSent);

router.post(
  "/:id/accept",
  [param("id").isMongoId().withMessage("Gecersiz basvuru ID")],
  acceptAdoptionApplication
);

router.post(
  "/:id/reject",
  [param("id").isMongoId().withMessage("Gecersiz basvuru ID")],
  rejectAdoptionApplication
);

export default router;
