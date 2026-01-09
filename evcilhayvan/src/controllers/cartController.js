import mongoose from "mongoose";
import CartItem from "../models/CartItem.js";
import Product from "../models/Product.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

function parseQuantity(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 1;
  return Math.floor(qty);
}

async function buildCartResponse(userId) {
  const items = await CartItem.find({ user: userId }).populate({
    path: "product",
    populate: { path: "store", select: "name logoUrl" },
  });

  const validItems = [];
  let total = 0;
  let itemCount = 0;

  for (const item of items) {
    if (!item.product || item.product.isActive === false) {
      await CartItem.deleteOne({ _id: item._id });
      continue;
    }
    const price = Number(item.product.price || 0);
    total += price * item.quantity;
    itemCount += item.quantity;
    validItems.push(item);
  }

  return {
    items: validItems,
    summary: { total, itemCount },
  };
}

export async function addToCart(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return sendError(res, 401, "Kimlik dogrulama gerekli", "auth_required");

    const { productId, quantity } = req.body || {};
    const qty = Math.max(parseQuantity(quantity), 1);
    if (!productId) return sendError(res, 400, "productId gerekli", "validation_error");

    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      return sendError(res, 404, "Urun bulunamadi", "product_not_found");
    }

    let item = await CartItem.findOne({ user: userId, product: productId });
    if (item) {
      item.quantity += qty;
    } else {
      item = new CartItem({ user: userId, product: productId, quantity: qty });
    }
    await item.save();

    const cart = await buildCartResponse(userId);
    return sendOk(res, 201, { item, ...cart });
  } catch (err) {
    return sendError(res, 500, "Sepete eklenemedi", "internal_error", err.message);
  }
}

export async function getCart(req, res) {
  try {
    const userId = req.user?.sub;
    const cart = await buildCartResponse(userId);
    return sendOk(res, 200, cart);
  } catch (err) {
    return sendError(res, 500, "Sepet alinmadi", "internal_error", err.message);
  }
}

export async function updateCartItem(req, res) {
  try {
    const userId = req.user?.sub;
    const { itemId } = req.params;
    const qty = parseQuantity(req.body?.qty ?? req.body?.quantity);

    const filter = { user: userId, _id: itemId };
    const item = await CartItem.findOne(filter);
    if (!item) return sendError(res, 404, "Sepet ogesi bulunamadi", "cart_item_not_found");

    if (qty <= 0) {
      await item.deleteOne();
    } else {
      item.quantity = qty;
      await item.save();
    }

    const cart = await buildCartResponse(userId);
    return sendOk(res, 200, cart);
  } catch (err) {
    return sendError(res, 500, "Sepet guncellenemedi", "internal_error", err.message);
  }
}

async function deleteCartItemInternal(userId, idOrProduct) {
  const filter = { user: userId };
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrProduct);
  if (isObjectId) {
    filter.$or = [{ _id: idOrProduct }, { product: idOrProduct }];
  } else {
    filter.product = idOrProduct;
  }
  await CartItem.findOneAndDelete(filter);
}

export async function removeFromCart(req, res) {
  try {
    const userId = req.user?.sub;
    await deleteCartItemInternal(userId, req.params.productId);
    const cart = await buildCartResponse(userId);
    return sendOk(res, 200, { message: "Urun sepetten kaldirildi", ...cart });
  } catch (err) {
    return sendError(res, 500, "Silme basarisiz", "internal_error", err.message);
  }
}

export async function deleteCartItem(req, res) {
  try {
    const userId = req.user?.sub;
    await deleteCartItemInternal(userId, req.params.itemId);
    const cart = await buildCartResponse(userId);
    return sendOk(res, 200, cart);
  } catch (err) {
    return sendError(res, 500, "Silme basarisiz", "internal_error", err.message);
  }
}

export async function clearCart(req, res) {
  try {
    const userId = req.user?.sub;
    await CartItem.deleteMany({ user: userId });
    return sendOk(res, 200, { items: [], summary: { total: 0, itemCount: 0 } });
  } catch (err) {
    return sendError(res, 500, "Sepet temizlenemedi", "internal_error", err.message);
  }
}
