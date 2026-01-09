import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { applySeller } from "../controllers/sellerApplicationController.js";
import {
  createSellerProduct,
  deleteSellerProduct,
  getSellerProducts,
  updateSellerProduct,
} from "../controllers/sellerProductController.js";

const router = Router();

router.post("/seller/apply", authRequired(), applySeller);

router.post("/seller/products", authRequired(["seller", "admin"]), createSellerProduct);
router.get("/seller/products", authRequired(["seller", "admin"]), getSellerProducts);
router.patch("/seller/products/:id", authRequired(["seller", "admin"]), updateSellerProduct);
router.delete("/seller/products/:id", authRequired(["seller", "admin"]), deleteSellerProduct);

export default router;
