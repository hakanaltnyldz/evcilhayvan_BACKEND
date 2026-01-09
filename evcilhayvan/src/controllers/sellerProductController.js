import Product from "../models/Product.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { recordAudit } from "../utils/audit.js";

export async function createSellerProduct(req, res) {
  try {
    const sellerId = req.user?.sub;
    if (!sellerId) return sendError(res, 401, "Kimlik dogrulama gerekli", "auth_required");

    const { name, description, price, stock, images, category, isActive } = req.body || {};
    if (!name || price === undefined || price === null) {
      return sendError(res, 400, "Isim ve fiyat zorunludur", "validation_error");
    }

    const product = await Product.create({
      name,
      title: name,
      description,
      price: Number(price),
      stock: typeof stock === "number" ? stock : Number(stock) || 0,
      images: Array.isArray(images) ? images : [],
      photos: Array.isArray(images) ? images : [],
      category,
      isActive: typeof isActive === "boolean" ? isActive : true,
      seller: sellerId,
    });

    await recordAudit("product.create", {
      userId: sellerId,
      entityType: "product",
      entityId: product._id.toString(),
    });

    return sendOk(res, 201, { product });
  } catch (err) {
    console.error("[createSellerProduct] error", err);
    return sendError(res, 500, "Urun olusturulamadi", "internal_error", err.message);
  }
}

export async function getSellerProducts(req, res) {
  try {
    const sellerId = req.user?.sub;
    const products = await Product.find({ seller: sellerId });
    return sendOk(res, 200, { products });
  } catch (err) {
    console.error("[getSellerProducts] error", err);
    return sendError(res, 500, "Urunler getirilemedi", "internal_error", err.message);
  }
}

export async function updateSellerProduct(req, res) {
  try {
    const sellerId = req.user?.sub;
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.name && !updates.title) updates.title = updates.name;
    if (updates.images && !updates.photos) updates.photos = updates.images;

    const product = await Product.findOneAndUpdate({ _id: id, seller: sellerId }, updates, { new: true });
    if (!product) return sendError(res, 404, "Urun bulunamadi", "product_not_found");

    await recordAudit("product.update", {
      userId: sellerId,
      entityType: "product",
      entityId: id,
    });

    return sendOk(res, 200, { product });
  } catch (err) {
    console.error("[updateSellerProduct] error", err);
    return sendError(res, 500, "Urun guncellenemedi", "internal_error", err.message);
  }
}

export async function deleteSellerProduct(req, res) {
  try {
    const sellerId = req.user?.sub;
    const { id } = req.params;
    const product = await Product.findOneAndDelete({ _id: id, seller: sellerId });
    if (!product) return sendError(res, 404, "Urun bulunamadi", "product_not_found");

    await recordAudit("product.delete", {
      userId: sellerId,
      entityType: "product",
      entityId: id,
    });

    return sendOk(res, 200, { message: "Silindi" });
  } catch (err) {
    console.error("[deleteSellerProduct] error", err);
    return sendError(res, 500, "Urun silinemedi", "internal_error", err.message);
  }
}
