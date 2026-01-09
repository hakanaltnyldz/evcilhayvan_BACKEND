import Category from "../models/Category.js";
import Product from "../models/Product.js";
import SellerProfile from "../models/SellerProfile.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

const defaultCategories = [
  { name: "Mama", icon: "food" },
  { name: "Oyuncak", icon: "toy" },
  { name: "Aksesuar", icon: "accessory" },
  { name: "Saglik", icon: "health" },
  { name: "Bakim", icon: "care" },
];

function slugify(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "kategori";
}

async function ensureDefaultCategories() {
  const tasks = defaultCategories.map((cat) => {
    const slug = slugify(cat.name);
    return Category.findOneAndUpdate(
      { $or: [{ slug }, { name: cat.name }] },
      { name: cat.name, slug, icon: cat.icon ?? null },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });
  await Promise.all(tasks);

  const missingSlugDocs = await Category.find({
    $or: [{ slug: { $exists: false } }, { slug: "" }],
  });
  await Promise.all(
    missingSlugDocs.map((doc) => {
      doc.slug = slugify(doc.name);
      return doc.save();
    })
  );
}

export async function getCategories(_req, res) {
  try {
    await ensureDefaultCategories();
    const categories = await Category.find().sort({ name: 1 });
    return sendOk(res, 200, { categories });
  } catch (err) {
    console.error("[getCategories] error", err);
    return sendError(res, 500, "Kategoriler alinmadi", "internal_error", err.message);
  }
}

export async function getStorefrontProducts(req, res) {
  try {
    const { category, q, search } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const term = q || search;
    if (term) filter.name = { $regex: term, $options: "i" };

    const products = await Product.find(filter).populate("category", "name slug");
    return sendOk(res, 200, { products });
  } catch (err) {
    console.error("[getStorefrontProducts] error", err);
    return sendError(res, 500, "Urunler alinmadi", "internal_error", err.message);
  }
}

export async function getProductDetail(req, res) {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name slug");
    if (!product || !product.isActive) return sendError(res, 404, "Urun bulunamadi", "product_not_found");
    return sendOk(res, 200, { product });
  } catch (err) {
    console.error("[getProductDetail] error", err);
    return sendError(res, 500, "Urun alinmadi", "internal_error", err.message);
  }
}

export async function getSellerProfile(req, res) {
  try {
    const { userId } = req.params;
    const profile = await SellerProfile.findOne({ user: userId });
    if (!profile) return sendError(res, 404, "Magaza bulunamadi", "store_not_found");

    const products = await Product.find({ seller: userId, isActive: true });
    return sendOk(res, 200, { profile, products });
  } catch (err) {
    console.error("[getSellerProfile] error", err);
    return sendError(res, 500, "Magaza bilgisi alinmadi", "internal_error", err.message);
  }
}
