import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import {
  approveApplication,
  listSellerApplications,
  rejectApplication,
} from "../controllers/sellerApplicationController.js";

const router = Router();

router.get("/admin/seller/applications", authRequired(["admin"]), listSellerApplications);
router.patch("/admin/seller/applications/:id/approve", authRequired(["admin"]), approveApplication);
router.patch("/admin/seller/applications/:id/reject", authRequired(["admin"]), rejectApplication);

export default router;
