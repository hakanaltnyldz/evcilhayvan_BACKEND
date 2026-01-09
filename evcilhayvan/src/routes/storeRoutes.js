import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import {
  addProduct,
  applySeller,
  discoverStores,
  getMyProducts,
  getMyStore,
  getStore,
  getStoreProducts,
  productFeed,
} from "../controllers/storeController.js";

const router = Router();

router.get("/discover", discoverStores);
router.get("/feed", productFeed);
router.get("/me", authRequired(["seller", "admin"]), getMyStore);
router.get("/me/products", authRequired(["seller", "admin"]), getMyProducts);
router.post("/apply", authRequired(), applySeller); // legacy
router.post("/create", authRequired(), applySeller);
router.post("/", authRequired(), applySeller); // alias to meet /api/store
router.post("/products", authRequired(["seller", "admin"]), addProduct);
router.post("/me/products", authRequired(["seller", "admin"]), addProduct);
router.get("/:storeId/products", getStoreProducts);
router.get("/:storeId", getStore);

export default router;
