// src/controllers/interactionController.js
import Interaction from "../models/Interaction.js";
import Pet from "../models/Pet.js";
import Conversation from "../models/Conversation.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

// Eslestirme kontrolu + gerekli konusmalarin hazirlanmasi
async function checkForMatch(reqUser, likedPet) {
  const myPets = await Pet.find({ ownerId: reqUser.sub }).select("_id");
  if (!myPets.length) return { match: false };

  const myPetIds = myPets.map((p) => p._id);

  const matchInteraction = await Interaction.findOne({
    fromUser: likedPet.ownerId._id,
    toPet: { $in: myPetIds },
    type: "like",
  }).populate("toPet");

  if (!matchInteraction) return { match: false };

  try {
    await Conversation.findOneAndUpdate(
      {
        relatedPet: likedPet._id,
        participants: { $all: [reqUser.sub, likedPet.ownerId._id] },
      },
      {
        participants: [reqUser.sub, likedPet.ownerId._id],
        relatedPet: likedPet._id,
        lastMessage: "Eslestiniz! Sohbete baslayin.",
      },
      { upsert: true, new: true }
    );

    await Conversation.findOneAndUpdate(
      {
        relatedPet: matchInteraction.toPet._id,
        participants: { $all: [reqUser.sub, likedPet.ownerId._id] },
      },
      {
        participants: [reqUser.sub, likedPet.ownerId._id],
        relatedPet: matchInteraction.toPet._id,
        lastMessage: "Eslestiniz! Sohbete baslayin.",
      },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error("[MATCH] conversation creation failed:", e);
  }

  return { match: true, matchedWithUser: likedPet.ownerId };
}

export async function likePet(req, res) {
  try {
    const fromUserId = req.user.sub;
    const { petId } = req.params;

    const likedPet = await Pet.findById(petId).populate("ownerId", "name avatarUrl");
    if (!likedPet) return sendError(res, 404, "Ilan bulunamadi", "pet_not_found");

    if (String(likedPet.ownerId._id) === String(fromUserId)) {
      return sendError(res, 400, "Kendi ilaniniz etkilesilemez", "validation_error");
    }

    const existing = await Interaction.findOne({
      fromUser: fromUserId,
      toPet: petId,
    });

    if (!existing) {
      await Interaction.create({
        fromUser: fromUserId,
        toPet: petId,
        toPetOwner: likedPet.ownerId._id,
        type: "like",
      });
    }

    const { match, matchedWithUser } = await checkForMatch(req.user, likedPet);

    let conversationId = null;
    if (match) {
      const convo = await Conversation.findOne({
        participants: { $all: [fromUserId, likedPet.ownerId._id] },
        relatedPet: likedPet._id,
      });
      if (convo) conversationId = String(convo._id);
    }

    return sendOk(res, existing ? 200 : 201, {
      type: "like",
      match,
      matchedWith: matchedWithUser,
      conversationId,
    });
  } catch (err) {
    console.error("[likePet]", err);
    return sendError(res, 500, "Islem basarisiz", "internal_error", err.message);
  }
}

export async function passPet(req, res) {
  try {
    const fromUserId = req.user.sub;
    const { petId } = req.params;

    const petToPass = await Pet.findById(petId);
    if (!petToPass) return sendError(res, 404, "Ilan bulunamadi", "pet_not_found");
    if (String(petToPass.ownerId) === String(fromUserId)) {
      return sendError(res, 400, "Kendi ilaniniz gecilemez", "validation_error");
    }

    const exists = await Interaction.findOne({ fromUser: fromUserId, toPet: petId });
    if (exists) {
      return sendError(res, 409, "Bu ilanla zaten etkilesime girdiniz", "already_interacted");
    }

    await Interaction.create({
      fromUser: fromUserId,
      toPet: petId,
      toPetOwner: petToPass.ownerId,
      type: "pass",
    });

    return sendOk(res, 201, { type: "pass", match: false });
  } catch (err) {
    console.error("[passPet]", err);
    return sendError(res, 500, "Islem basarisiz", "internal_error", err.message);
  }
}
