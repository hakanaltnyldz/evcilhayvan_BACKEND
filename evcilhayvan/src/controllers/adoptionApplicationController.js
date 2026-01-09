import mongoose from "mongoose";

import Pet from "../models/Pet.js";
import AdoptionApplication from "../models/AdoptionApplication.js";
import { ensureConversationWithSystemMessage } from "../services/conversationService.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { io } from "../../server.js";

const applicationPopulate = [
  { path: "adoptionListingId", select: "name images photos ownerId species advertType" },
  { path: "applicantUserId", select: "name avatarUrl email" },
];

function shapeUser(user, fallbackId) {
  if (user && typeof user === "object") {
    return {
      id: user._id ? String(user._id) : fallbackId ? String(fallbackId) : undefined,
      name: user.name,
      avatarUrl: user.avatarUrl,
      email: user.email,
    };
  }
  return { id: fallbackId ? String(fallbackId) : undefined };
}

function shapePet(pet, fallbackId) {
  if (pet && typeof pet === "object") {
    const images = Array.isArray(pet.images) && pet.images.length ? pet.images : pet.photos || [];
    return {
      id: pet._id ? String(pet._id) : fallbackId ? String(fallbackId) : undefined,
      name: pet.name,
      species: pet.species,
      images,
      advertType: pet.advertType,
    };
  }
  return { id: fallbackId ? String(fallbackId) : undefined };
}

function shapeAdoptionApplication(doc, extras = {}) {
  const listing = doc.adoptionListingId && typeof doc.adoptionListingId === "object" ? doc.adoptionListingId : null;
  const applicant = doc.applicantUserId && typeof doc.applicantUserId === "object" ? doc.applicantUserId : null;
  const conversationId = extras.conversationId || doc.conversationId || null;

  return {
    id: doc.id || String(doc._id),
    adoptionListingId: listing?._id ? String(listing._id) : String(doc.adoptionListingId),
    listing: listing ? shapePet(listing) : null,
    applicantUser: shapeUser(applicant, doc.applicantUserId),
    status: doc.status,
    note: doc.note ?? null,
    createdAt: doc.createdAt,
    respondedAt: doc.respondedAt,
    conversationId,
  };
}

export async function createAdoptionApplication(req, res) {
  try {
    const userId = req.user.sub;
    const { adoptionListingId, note } = req.body || {};

    if (!adoptionListingId || !mongoose.Types.ObjectId.isValid(adoptionListingId)) {
      return sendError(res, 400, "Gecersiz ilan ID", "validation_error");
    }

    const listing = await Pet.findById(adoptionListingId).populate("ownerId", "name avatarUrl");
    if (!listing || !listing.isActive) {
      return sendError(res, 404, "Ilan bulunamadi", "listing_not_found");
    }
    if (listing.advertType !== "adoption") {
      return sendError(res, 400, "Yalnizca sahiplendirme ilanlarina basvuru yapabilirsiniz", "invalid_advert_type");
    }
    if (String(listing.ownerId?._id || listing.ownerId) === String(userId)) {
      return sendError(res, 400, "Kendi ilaniniz icin basvuru yapamazsiniz", "validation_error");
    }

    const existing = await AdoptionApplication.findOne({
      adoptionListingId,
      applicantUserId: userId,
      status: "PENDING",
    }).populate(applicationPopulate);
    if (existing) {
      return sendError(res, 409, "Basvuru zaten beklemede", "duplicate_application", {
        application: shapeAdoptionApplication(existing),
      });
    }

    const application = await AdoptionApplication.create({
      adoptionListingId,
      applicantUserId: userId,
      status: "PENDING",
      note: note ? String(note).trim() : null,
    });

    const populated = await application.populate(applicationPopulate);
    const shaped = shapeAdoptionApplication(populated);

    if (io?.to) {
      io.to(`user:${String(listing.ownerId?._id || listing.ownerId)}`).emit("adoption_application:new", {
        application: shaped,
      });
    }

    return sendOk(res, 201, { application: shaped });
  } catch (err) {
    if (err?.code === 11000) {
      return sendError(res, 409, "Basvuru zaten beklemede", "duplicate_application");
    }
    console.error("[createAdoptionApplication]", err);
    return sendError(res, 500, "Basvuru gonderilemedi", "internal_error", err.message);
  }
}

export async function getAdoptionApplicationsInbox(req, res) {
  try {
    const userId = req.user.sub;
    const listings = await Pet.find({ ownerId: userId, advertType: "adoption" }).select("_id");
    const listingIds = listings.map((doc) => doc._id);

    if (!listingIds.length) {
      return sendOk(res, 200, { items: [] });
    }

    const applications = await AdoptionApplication.find({ adoptionListingId: { $in: listingIds } })
      .sort({ createdAt: -1 })
      .populate(applicationPopulate);

    return sendOk(res, 200, { items: applications.map((doc) => shapeAdoptionApplication(doc)) });
  } catch (err) {
    console.error("[getAdoptionApplicationsInbox]", err);
    return sendError(res, 500, "Basvurular alinmadi", "internal_error", err.message);
  }
}

export async function getAdoptionApplicationsSent(req, res) {
  try {
    const userId = req.user.sub;
    const applications = await AdoptionApplication.find({ applicantUserId: userId })
      .sort({ createdAt: -1 })
      .populate(applicationPopulate);

    return sendOk(res, 200, { items: applications.map((doc) => shapeAdoptionApplication(doc)) });
  } catch (err) {
    console.error("[getAdoptionApplicationsSent]", err);
    return sendError(res, 500, "Basvurular alinmadi", "internal_error", err.message);
  }
}

export async function acceptAdoptionApplication(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Gecersiz basvuru ID", "validation_error");
    }

    const application = await AdoptionApplication.findById(id).populate(applicationPopulate);
    if (!application) {
      return sendError(res, 404, "Basvuru bulunamadi", "not_found");
    }

    const listing = await Pet.findById(application.adoptionListingId).select("ownerId");
    if (!listing) {
      return sendError(res, 404, "Ilan bulunamadi", "listing_not_found");
    }
    if (String(listing.ownerId) !== String(userId)) {
      return sendError(res, 403, "Bu islem icin yetkiniz yok", "forbidden");
    }
    if (application.status !== "PENDING") {
      return sendError(res, 400, "Bu basvuru zaten sonuclandi", "invalid_status");
    }

    application.status = "ACCEPTED";
    application.respondedAt = new Date();
    await application.save();

    const { conversation, message } = await ensureConversationWithSystemMessage({
      fromUserId: application.applicantUserId,
      toUserId: listing.ownerId,
      contextType: "ADOPTION",
      contextId: application.adoptionListingId,
      systemText: "Sahiplendirme basvurusu kabul edildi.",
      actorId: userId,
    });

    const conversationId = conversation._id.toString();
    const shaped = shapeAdoptionApplication(application, { conversationId });

    if (io?.to) {
      io.to(`user:${String(listing.ownerId)}`).emit("adoption_application:accepted", {
        application: shaped,
        conversationId,
      });
      io.to(`user:${String(application.applicantUserId)}`).emit("adoption_application:accepted", {
        application: shaped,
        conversationId,
      });
      io.to(`user:${String(listing.ownerId)}`).emit("conversation:created", {
        conversationId,
        conversation,
      });
      io.to(`user:${String(application.applicantUserId)}`).emit("conversation:created", {
        conversationId,
        conversation,
      });
      io.to(`conv:${conversationId}`).emit("message:new", { message });
    }

    return sendOk(res, 200, { application: shaped, conversationId });
  } catch (err) {
    console.error("[acceptAdoptionApplication]", err);
    return sendError(res, 500, "Basvuru guncellenemedi", "internal_error", err.message);
  }
}

export async function rejectAdoptionApplication(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Gecersiz basvuru ID", "validation_error");
    }

    const application = await AdoptionApplication.findById(id).populate(applicationPopulate);
    if (!application) {
      return sendError(res, 404, "Basvuru bulunamadi", "not_found");
    }

    const listing = await Pet.findById(application.adoptionListingId).select("ownerId");
    if (!listing) {
      return sendError(res, 404, "Ilan bulunamadi", "listing_not_found");
    }
    if (String(listing.ownerId) !== String(userId)) {
      return sendError(res, 403, "Bu islem icin yetkiniz yok", "forbidden");
    }
    if (application.status !== "PENDING") {
      return sendError(res, 400, "Bu basvuru zaten sonuclandi", "invalid_status");
    }

    application.status = "REJECTED";
    application.respondedAt = new Date();
    await application.save();

    return sendOk(res, 200, { application: shapeAdoptionApplication(application) });
  } catch (err) {
    console.error("[rejectAdoptionApplication]", err);
    return sendError(res, 500, "Basvuru guncellenemedi", "internal_error", err.message);
  }
}
