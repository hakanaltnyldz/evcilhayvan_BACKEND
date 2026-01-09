import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import {
  getCategories,
  getProductDetail,
  getSellerProfile,
  getStorefrontProducts,
} from "../controllers/storeFrontController.js";
import {
  addToCart,
  clearCart,
  deleteCartItem,
  getCart,
  removeFromCart,
  updateCartItem,
} from "../controllers/cartController.js";

const router = Router();

router.get("/store/categories", getCategories);
router.get("/store/products", getStorefrontProducts);
router.get("/store/products/:id", getProductDetail);
router.get("/store/sellers/:userId", getSellerProfile);

router.post("/store/cart/add", authRequired(), addToCart);
router.get("/store/cart", authRequired(), getCart);
router.delete("/store/cart/:productId", authRequired(), removeFromCart);

// Cart v2 (preferred)
router.get("/cart", authRequired(), getCart);
router.post("/cart/items", authRequired(), addToCart);
router.patch("/cart/items/:itemId", authRequired(), updateCartItem);
router.delete("/cart/items/:itemId", authRequired(), deleteCartItem);
router.post("/cart/clear", authRequired(), clearCart);

export default router;
