import mongoose from "mongoose";

import Pet from "../models/Pet.js";
import Conversation from "../models/Conversation.js";
import MatchRequest from "../models/MatchRequest.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { ensureConversationWithSystemMessage } from "../services/conversationService.js";
import { io } from "../../server.js";

const turkishSpeciesMap = {
  dog: "Kopek",
  cat: "Kedi",
  bird: "Kus",
  fish: "Balik",
  rodent: "Kemirgen",
  other: "Diger",
};

const turkishGenderMap = {
  male: "Erkek",
  female: "Dişi",
  unknown: "Bilinmiyor",
};

const reverseSpeciesMap = Object.fromEntries(
  Object.entries(turkishSpeciesMap).map(([key, value]) => [value.toLowerCase(), key])
);

const reverseGenderMap = Object.fromEntries(
  Object.entries(turkishGenderMap).map(([key, value]) => [value.toLowerCase(), key])
);

function normalizeEnum(value, reverseMap) {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  return reverseMap[lower] ?? lower;
}

function formatSpecies(value) {
  const lower = String(value || "").toLowerCase();
  return turkishSpeciesMap[lower] ?? value ?? "";
}

function formatGender(value) {
  const lower = String(value || "").toLowerCase();
  return turkishGenderMap[lower] ?? value ?? "";
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function isValidCoordinates(location) {
  const coords = location?.coordinates;
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every((num) => typeof num === "number" && !Number.isNaN(num)) &&
    !(coords[0] === 0 && coords[1] === 0)
  );
}

const matchRequestPopulate = [
  { path: "advertId", select: "name advertType images photos ownerId species gender" },
  { path: "fromAdvertId", select: "name advertType images photos ownerId species gender" },
  { path: "fromUserId", select: "name avatarUrl email" },
  { path: "toUserId", select: "name avatarUrl email" },
];

function shapeMatchRequest(doc, extras = {}) {
  const advert = doc.advertId && typeof doc.advertId === "object" ? doc.advertId : null;
  const fromAdvert = doc.fromAdvertId && typeof doc.fromAdvertId === "object" ? doc.fromAdvertId : null;
  const fromUser = doc.fromUserId && typeof doc.fromUserId === "object" ? doc.fromUserId : null;
  const toUser = doc.toUserId && typeof doc.toUserId === "object" ? doc.toUserId : null;
  const conversationId = extras.conversationId || doc.conversationId || null;

  return {
    id: doc.id || String(doc._id),
    advertId: advert?._id ? String(advert._id) : String(doc.advertId),
    targetAdvertId: advert?._id ? String(advert._id) : String(doc.advertId),
    advertType: doc.advertType || advert?.advertType || null,
    advertName: advert?.name,
    fromAdvertId: fromAdvert?._id ? String(fromAdvert._id) : doc.fromAdvertId ? String(doc.fromAdvertId) : null,
    fromAdvertName: fromAdvert?.name,
    fromUser: fromUser
      ? { id: String(fromUser._id), name: fromUser.name, avatarUrl: fromUser.avatarUrl }
      : { id: String(doc.fromUserId) },
    toUser: toUser
      ? { id: String(toUser._id), name: toUser.name, avatarUrl: toUser.avatarUrl }
      : { id: String(doc.toUserId) },
    status: doc.status,
    note: doc.note ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    conversationId,
  };
}

export async function createMatchRequest(req, res) {
  try {
    const userId = req.user.sub;
    const advertId =
      req.body?.targetAdvertId || req.body?.advertId || req.params?.advertId || req.params?.profileId;
    const { note } = req.body || {};
    const requestedFromAdvertId = req.body?.fromAdvertId || req.body?.requesterPetId;

    if (!advertId || !mongoose.Types.ObjectId.isValid(advertId)) {
      return sendError(res, 400, "Gecersiz ilan ID", "validation_error");
    }

    const advert = await Pet.findById(advertId).populate("ownerId", "name avatarUrl gender species");
    if (!advert || !advert.isActive) {
      return sendError(res, 404, "Ilan bulunamadi", "pet_not_found");
    }
    if (advert.advertType !== "mating") {
      return sendError(res, 400, "Yalnizca eslestirme ilanlarina istek gonderebilirsiniz", "invalid_advert_type");
    }
    if (String(advert.ownerId?._id || advert.ownerId) === String(userId)) {
      return sendError(res, 400, "Kendi ilaniniza istek gonderemezsiniz", "validation_error");
    }

    const requesterFilter = { ownerId: userId, advertType: "mating", isActive: true };
    let requesterAdvert = null;
    if (requestedFromAdvertId) {
      if (!mongoose.Types.ObjectId.isValid(requestedFromAdvertId)) {
        return sendError(res, 400, "Gecersiz secilen ilan ID", "validation_error");
      }
      requesterAdvert = await Pet.findOne({ ...requesterFilter, _id: requestedFromAdvertId });
      if (!requesterAdvert) {
        return sendError(
          res,
          400,
          "Eslestirme istegi gondermek icin kendi eslestirme ilanini secmelisin",
          "NO_MATING_ADVERT"
        );
      }
    } else {
      requesterAdvert = await Pet.findOne(requesterFilter).sort({ updatedAt: -1 });
      if (!requesterAdvert) {
        return sendError(
          res,
          400,
          "Eslestirme istegi gondermek icin once kendi eslestirme ilanini olusturmalisin.",
          "NO_MATING_ADVERT"
        );
      }
    }

    const sameSpecies =
      requesterAdvert?.species && advert?.species
        ? String(requesterAdvert.species) === String(advert.species)
        : true;
    const differentGender =
      requesterAdvert?.gender && advert?.gender && requesterAdvert.gender !== "unknown" && advert.gender !== "unknown"
        ? requesterAdvert.gender !== advert.gender
        : true;
    if (!sameSpecies || !differentGender) {
      return sendError(
        res,
        400,
        "Ayni turden ve uygun cinsiyette bir ilan secmelisin.",
        "requester_pet_invalid"
      );
    }

    const existing = await MatchRequest.findOne({ fromUserId: userId, advertId, status: "pending" }).populate(
      matchRequestPopulate
    );
    if (existing) {
      return sendOk(res, 200, {
        request: shapeMatchRequest(existing),
        message: "Eslestirme istegi zaten gonderildi.",
      });
    }

    const request = await MatchRequest.create({
      advertId,
      advertType: advert.advertType || "mating",
      fromUserId: userId,
      toUserId: advert.ownerId._id || advert.ownerId,
      fromAdvertId: requesterAdvert?._id,
      note,
      status: "pending",
      requesterPet: requesterAdvert?._id,
    });

    const populated = await request.populate(matchRequestPopulate);
    const shapedRequest = shapeMatchRequest(populated);

    // Emit Socket.io event to notify target user
    if (io?.to) {
      const toUserRoom = `user:${String(advert.ownerId._id || advert.ownerId)}`;

      // Get sender info for notification
      const senderUser = populated.fromUserId;
      const senderPet = populated.fromAdvertId;

      io.to(toUserRoom).emit("match_request", {
        requestId: String(request._id),
        senderName: senderUser?.name || "Bilinmeyen",
        senderPetName: senderPet?.name || "Bilinmeyen",
        senderPetImage: senderPet?.photos?.[0] || senderPet?.images?.[0] || null,
        fromAdvertId: senderPet?._id ? String(senderPet._id) : null,
      });
    }

    return sendOk(res, 201, {
      request: shapedRequest,
      message: "Eslestirme istegi gonderildi.",
    });
  } catch (err) {
    console.error("[createMatchRequest]", err);
    return sendError(res, 500, "Eslestirme istegi gonderilemedi", "internal_error", err.message);
  }
}

export async function getInboxRequests(req, res) {
  try {
    const userId = req.user.sub;
    const requests = await MatchRequest.find({ toUserId: userId }).sort({ createdAt: -1 }).populate(matchRequestPopulate);

    return sendOk(res, 200, { items: requests.map(shapeMatchRequest) });
  } catch (err) {
    console.error("[getInboxRequests]", err);
    return sendError(res, 500, "Istekler alinmadi", "internal_error", err.message);
  }
}

export async function getOutboxRequests(req, res) {
  try {
    const userId = req.user.sub;
    const requests = await MatchRequest.find({ fromUserId: userId })
      .sort({ createdAt: -1 })
      .populate(matchRequestPopulate);

    return sendOk(res, 200, { items: requests.map(shapeMatchRequest) });
  } catch (err) {
    console.error("[getOutboxRequests]", err);
    return sendError(res, 500, "Gonderilen istekler alinmadi", "internal_error", err.message);
  }
}

export async function updateMatchRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const action = (req.body?.action || "").toLowerCase();
    const userId = req.user.sub;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Gecersiz istek ID", "validation_error");
    }
    if (!["accept", "reject", "cancel"].includes(action)) {
      return sendError(res, 400, "Gecersiz islem", "validation_error");
    }

    const request = await MatchRequest.findById(id).populate(matchRequestPopulate);
    if (!request) {
      return sendError(res, 404, "Istek bulunamadi", "not_found");
    }

    const isOwnerAction = action === "accept" || action === "reject";
    if (isOwnerAction && String(request.toUserId) !== String(userId)) {
      return sendError(res, 403, "Bu islem icin yetkiniz yok", "forbidden");
    }
    if (action === "cancel" && String(request.fromUserId) !== String(userId)) {
      return sendError(res, 403, "Bu islem icin yetkiniz yok", "forbidden");
    }

    if (request.status !== "pending") {
      return sendError(res, 400, "Bu istek zaten sonuclanmis", "invalid_status");
    }

    if (!request.advertType) {
      request.advertType = "mating";
    }

    let conversationId = null;
    let conversation = null;
    let systemMessage = null;

    if (action === "accept") {
      request.status = "accepted";

      // Use conversationService for consistent conversation creation
      const result = await ensureConversationWithSystemMessage({
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        contextType: "MATCHING",
        contextId: request.advertId,
        systemText: "Eslestirme istegi kabul edildi.",
        actorId: userId,
      });

      conversation = result.conversation;
      systemMessage = result.message;
      conversationId = conversation._id.toString();
    } else if (action === "reject") {
      request.status = "rejected";
    } else if (action === "cancel") {
      request.status = "cancelled";
    }

    await request.save();
    const populated = await request.populate(matchRequestPopulate);
    const shapedRequest = shapeMatchRequest(populated, { conversationId });

    // Emit Socket.io events for real-time updates
    if (io?.to) {
      const fromUserRoom = `user:${String(request.fromUserId)}`;
      const toUserRoom = `user:${String(request.toUserId)}`;

      // Get user and pet info for notifications
      const fromUser = populated.fromUserId;
      const toUser = populated.toUserId;
      const fromPet = populated.fromAdvertId;
      const toPet = populated.advertId;

      if (action === "accept") {
        // Notify sender (fromUser) about acceptance
        io.to(fromUserRoom).emit("match_accepted", {
          conversationId,
          matchRequestId: String(request._id),
          partnerName: toUser?.name || "Bilinmeyen",
          partnerPetName: toPet?.name || "Bilinmeyen",
        });

        // Notify receiver (toUser) about acceptance
        io.to(toUserRoom).emit("match_accepted", {
          conversationId,
          matchRequestId: String(request._id),
          partnerName: fromUser?.name || "Bilinmeyen",
          partnerPetName: fromPet?.name || "Bilinmeyen",
        });

        // Notify about new conversation
        io.to(toUserRoom).emit("conversation:created", { conversationId, conversation });
        io.to(fromUserRoom).emit("conversation:created", { conversationId, conversation });

        // Send system message to conversation room
        if (systemMessage) {
          io.to(`conv:${conversationId}`).emit("message:new", { message: systemMessage });
        }
      } else if (action === "reject") {
        // Notify sender about rejection
        io.to(fromUserRoom).emit("match_rejected", {
          matchRequestId: String(request._id),
          rejectorName: toUser?.name || "Bilinmeyen",
        });
      } else if (action === "cancel") {
        io.to(toUserRoom).emit("matching_request:cancelled", { request: shapedRequest });
      }
    }

    return sendOk(res, 200, { request: shapedRequest, conversationId });
  } catch (err) {
    console.error("[updateMatchRequestStatus]", err);
    return sendError(res, 500, "Istek guncellenemedi", "internal_error", err.message);
  }
}

export async function getMatchingProfiles(req, res) {
  try {
    const userId = req.user.sub;
    const { species, gender, maxDistanceKm } = req.query;

    const normalizedSpecies = normalizeEnum(species, reverseSpeciesMap);
    const normalizedGender = normalizeEnum(gender, reverseGenderMap);
    const maxDistance = maxDistanceKm ? Number(maxDistanceKm) : null;

    const myPets = await Pet.find({ ownerId: userId, isActive: true }).select("_id location");

    const myLocationPet = myPets.find((pet) => isValidCoordinates(pet.location));
    const matchFilter = {
      ownerId: { $ne: toObjectId(userId) },
      isActive: true,
      advertType: "mating",
    };

    if (normalizedSpecies && normalizedSpecies !== "tum") {
      matchFilter.species = normalizedSpecies;
    }
    if (normalizedGender && normalizedGender !== "tum") {
      matchFilter.gender = normalizedGender;
    }

    const pipeline = [];
    if (myLocationPet) {
      const geoStage = {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: myLocationPet.location.coordinates,
          },
          distanceField: "distanceMeters",
          spherical: true,
        },
      };
      if (maxDistance && Number.isFinite(maxDistance) && maxDistance > 0) {
        geoStage.$geoNear.maxDistance = maxDistance * 1000;
      }
      pipeline.push(geoStage);
    } else {
      pipeline.push({
        $addFields: {
          distanceMeters: 0,
        },
      });
    }

    pipeline.push({ $match: matchFilter });
    pipeline.push({ $sort: { createdAt: -1 } });

    pipeline.push({
      $lookup: {
        from: "users",
        localField: "ownerId",
        foreignField: "_id",
        as: "owner",
      },
    });
    pipeline.push({
      $unwind: {
        path: "$owner",
        preserveNullAndEmptyArrays: true,
      },
    });

    const rawPets = await Pet.aggregate(pipeline);

    const targetPetIds = rawPets.map((pet) => pet._id);

    const existingRequests = await MatchRequest.find({
      fromUserId: userId,
      advertId: { $in: targetPetIds },
    }).lean();

    const requestStatusMap = new Map(existingRequests.map((doc) => [String(doc.advertId), doc.status]));

    const profiles = rawPets.map((pet) => {
      const rawDistance = (pet.distanceMeters || 0) / 1000;
      const distanceKm = Number(rawDistance.toFixed(2));
      const status = requestStatusMap.get(String(pet._id)) ?? null;

      return {
        id: String(pet._id),
        petId: String(pet._id),
        name: pet.name,
        species: formatSpecies(pet.species),
        breed: pet.breed || "Bilinmiyor",
        gender: formatGender(pet.gender),
        ageMonths: pet.ageMonths ?? 0,
        bio: pet.bio ?? "",
        images: pet.photos ?? [],
        distanceKm,
        hasPendingRequest: status === "pending",
        isMatched: status === "accepted",
      };
    });

    const filteredProfiles =
      maxDistance && Number.isFinite(maxDistance) && maxDistance > 0
        ? profiles.filter((profile) => profile.distanceKm <= maxDistance)
        : profiles;

    return sendOk(res, 200, { profiles: filteredProfiles });
  } catch (err) {
    console.error("[getMatchingProfiles]", err);
    return sendError(res, 500, "Eslestirme profilleri alinmadi", "internal_error", err.message);
  }
}


export async function sendMatchRequest(req, res) {
  req.body = { ...req.body, advertId: req.params?.profileId };
  return createMatchRequest(req, res);
}
