import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Pet from "../models/Pet.js";
import Interaction from "../models/Interaction.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { recordAudit } from "../utils/audit.js";
import { storageService } from "../services/storageService.js";

function buildLocation(bodyLocation) {
  if (bodyLocation?.coordinates?.length === 2) {
    return {
      type: "Point",
      coordinates: bodyLocation.coordinates.map(Number),
    };
  }
  return undefined;
}

// GET /api/pets/feed
export async function getPetFeed(req, res) {
  try {
    const userId = req.user.sub;
    const { page = 1, limit = 10 } = req.query;

    const interactions = await Interaction.find({ fromUser: userId }).select("toPet");
    const interactedPetIds = interactions.map((interaction) => interaction.toPet);

    const filter = {
      isActive: true,
      ownerId: { $ne: userId },
      _id: { $nin: interactedPetIds },
    };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Pet.find(filter)
        .populate("ownerId", "name avatarUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Pet.countDocuments(filter),
    ]);

    return sendOk(res, 200, {
      items,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("[getPetFeed]", err);
    return sendError(res, 500, "Akis yuklenemedi", "internal_error", err.message);
  }
}

// POST /api/pets
export async function createPet(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Dogrulama hatasi", "validation_error", errors.array());
  }

  const ownerId = req.user.sub;
  const body = { ...req.body, ownerId };
  const location = buildLocation(body.location);
  if (location) {
    body.location = location;
  } else {
    delete body.location;
  }

  if (Array.isArray(body.images) && !body.photos) {
    body.photos = body.images;
  }
  if (body.advertType) {
    const normalizedType = String(body.advertType).toLowerCase();
    if (["adoption", "mating"].includes(normalizedType)) {
      body.advertType = normalizedType;
    }
  }
  if (!body.advertType) {
    body.advertType = "adoption";
  }

  // İlanın aktif olduğundan emin ol
  body.isActive = true;

  let pet = await Pet.create(body);
  pet = await pet.populate("ownerId", "name avatarUrl");

  await recordAudit("pet.create", {
    userId: ownerId,
    entityType: "pet",
    entityId: pet.id || pet._id,
  });

  return sendOk(res, 201, { pet });
}

// GET /api/pets/me
export async function myPets(req, res) {
  try {
    if (!req.user?.sub) {
      return sendError(res, 401, "Gecersiz token", "auth_required");
    }
    const ownerId = req.user.sub;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return sendError(res, 400, "Gecersiz kullanici ID", "validation_error");
    }
    const pets = await Pet.find({ ownerId })
      .populate("ownerId", "name avatarUrl")
      .sort({ createdAt: -1 });
    return sendOk(res, 200, { pets });
  } catch (err) {
    console.error("[myPets]", err);
    return sendError(res, 500, "Ilanlar alinirken hata olustu", "internal_error", err.message);
  }
}

// GET /api/my-adverts
export async function myAdverts(req, res) {
  try {
    if (!req.user?.sub) {
      return sendError(res, 401, "Gecersiz token", "auth_required");
    }
    const ownerId = req.user.sub;
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return sendError(res, 400, "Gecersiz kullanici ID", "validation_error");
    }
    const { type } = req.query;
    const filter = { ownerId };
    if (type) {
      const normalizedType = String(type).toLowerCase();
      if (["adoption", "mating"].includes(normalizedType)) {
        filter.advertType = normalizedType;
      }
    }
    const pets = await Pet.find(filter)
      .populate("ownerId", "name avatarUrl")
      .sort({ createdAt: -1 });
    return sendOk(res, 200, { result: pets, pets, count: pets.length });
  } catch (err) {
    console.error("[myAdverts]", err);
    return sendError(res, 500, "Ilanlar alinirken hata olustu", "internal_error", err.message);
  }
}

// PUT /api/pets/:id
export async function updatePet(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Dogrulama hatasi", "validation_error", errors.array());
  }
  const { id } = req.params;
  const isAdmin = req.user.role === "admin";
  const pet = await Pet.findById(id);
  if (!pet) {
    return sendError(res, 404, "Pet bulunamadi", "pet_not_found");
  }
  if (!isAdmin && String(pet.ownerId) !== String(req.user.sub)) {
    return sendError(res, 403, "Bu ilan size ait degil", "forbidden");
  }

  const update = { ...req.body };
  const location = buildLocation(update.location);
  if (location) {
    update.location = location;
  } else if (update.location) {
    delete update.location;
  }

  if (Array.isArray(update.images) && !update.photos) {
    update.photos = update.images;
  }
  if (update.advertType) {
    const normalizedType = String(update.advertType).toLowerCase();
    if (["adoption", "mating"].includes(normalizedType)) {
      update.advertType = normalizedType;
    } else {
      delete update.advertType;
    }
  }

  Object.assign(pet, update);
  const saved = await pet.save();
  await saved.populate("ownerId", "name avatarUrl");

  await recordAudit("pet.update", {
    userId: req.user.sub,
    entityType: "pet",
    entityId: saved.id || saved._id,
  });

  return sendOk(res, 200, { pet: saved });
}

// GET /api/pets
export async function listPets(req, res) {
  try {
    const { species, vaccinated, q, page = 1, limit = 10, type } = req.query;
    const filter = { isActive: true };
    if (species) filter.species = species;
    if (type) {
      const normalizedType = String(type).toLowerCase();
      if (["adoption", "mating"].includes(normalizedType)) {
        filter.advertType = normalizedType;
      }
    }
    if (typeof vaccinated !== "undefined") filter.vaccinated = vaccinated === "true";
    if (q) {
      filter.$text = { $search: String(q) };
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Pet.find(filter)
        .populate("ownerId", "name avatarUrl")
        .sort(q ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Pet.countDocuments(filter),
    ]);
    return sendOk(res, 200, {
      items,
      page: Number(page),
      limit: Number(limit),
      total,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    return sendError(res, 500, "Ilanlar yuklenemedi", "internal_error", err.message);
  }
}

// GET /api/pets/:id
export async function getPet(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Gecersiz ilan ID", "validation_error");
    }

    const pet = await Pet.findById(id).populate("ownerId", "name avatarUrl");
    if (!pet || !pet.isActive) {
      return sendError(res, 404, "Ilan bulunamadi", "pet_not_found");
    }

    return sendOk(res, 200, { pet });
  } catch (err) {
    console.error("[getPet]", err);
    return sendError(res, 500, "Ilan detayi alinamadi", "internal_error", err.message);
  }
}

// DELETE /api/pets/:id
export async function deletePet(req, res) {
  const { id } = req.params;
  const filter = { _id: id };
  if (req.user.role !== "admin") {
    filter.ownerId = req.user.sub;
  }
  const pet = await Pet.findOneAndDelete(filter);
  if (!pet) return sendError(res, 404, "Pet bulunamadi veya yetkiniz yok", "pet_not_found");

  await recordAudit("pet.delete", {
    userId: req.user.sub,
    entityType: "pet",
    entityId: id,
  });

  return sendOk(res, 200, { deleted: true });
}

// POST /api/pets/:id/images
export async function uploadPetImage(req, res) {
  const { id } = req.params;
  const filter = { _id: id };
  if (req.user.role !== "admin") {
    filter.ownerId = req.user.sub;
  }
  const pet = await Pet.findOne(filter);
  if (!pet) return sendError(res, 404, "Pet bulunamadi veya yetkiniz yok", "pet_not_found");
  if (!req.file) return sendError(res, 400, "Dosya gerekli", "file_required");
  const publicPath = await storageService.save(req.file);
  pet.images = [...(pet.images || []), publicPath];
  if (!pet.photos) pet.photos = [];
  pet.photos = [...pet.photos, publicPath];
  await pet.save();

  await recordAudit("pet.media.upload", {
    userId: req.user.sub,
    entityType: "pet",
    entityId: id,
    metadata: { type: "image", url: publicPath },
  });

  return sendOk(res, 201, { url: publicPath, images: pet.images, photos: pet.photos });
}

// POST /api/pets/:id/videos
export async function uploadPetVideo(req, res) {
  const { id } = req.params;
  const filter = { _id: id };
  if (req.user.role !== "admin") {
    filter.ownerId = req.user.sub;
  }
  const pet = await Pet.findOne(filter);
  if (!pet) return sendError(res, 404, "Pet bulunamadi veya yetkiniz yok", "pet_not_found");
  if (!req.file) return sendError(res, 400, "Dosya gerekli", "file_required");
  const publicPath = await storageService.save(req.file);
  pet.videos = [...(pet.videos || []), publicPath];
  await pet.save();

  await recordAudit("pet.media.upload", {
    userId: req.user.sub,
    entityType: "pet",
    entityId: id,
    metadata: { type: "video", url: publicPath },
  });

  return sendOk(res, 201, { url: publicPath, videos: pet.videos });
}
