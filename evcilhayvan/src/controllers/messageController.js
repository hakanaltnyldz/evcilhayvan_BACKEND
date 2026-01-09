// src/controllers/messageController.js
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Pet from "../models/Pet.js";
import { io } from "../../server.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { recordAudit } from "../utils/audit.js";

export async function getMyConversations(req, res) {
  try {
    const userId = req.user.sub;

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "name avatarUrl email")
      .populate("relatedPet", "name photos images advertType")
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    return sendOk(res, 200, { conversations });
  } catch (err) {
    console.error("[getMyConversations]", err);
    return sendError(res, 500, "Sohbetler alinmadi", "internal_error", err.message);
  }
}

// GET /api/conversations/:conversationId (tek sohbet detayı)
export async function getConversationById(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.sub;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    })
      .populate("participants", "name avatarUrl email")
      .populate("relatedPet", "name photos images advertType species breed");

    if (!conversation) {
      return sendError(res, 404, "Sohbet bulunamadi veya yetkiniz yok", "conversation_not_found");
    }

    return sendOk(res, 200, { conversation });
  } catch (err) {
    console.error("[getConversationById]", err);
    return sendError(res, 500, "Sohbet bilgisi alinamadi", "internal_error", err.message);
  }
}

export async function getMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.sub;
    const { cursor } = req.query || {};

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });
    if (!conversation) {
      return sendError(res, 404, "Sohbet bulunamadi veya yetkiniz yok", "conversation_not_found");
    }

    const query = { conversationId };
    if (cursor) {
      if (mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: cursor };
      } else {
        const cursorDate = new Date(String(cursor));
        if (!Number.isNaN(cursorDate.getTime())) {
          query.createdAt = { $lt: cursorDate };
        }
      }
    }

    const messages = await Message.find(query)
      .populate("sender", "name email avatarUrl")
      .sort({ createdAt: 1 });

    const shaped = messages.map((msg) => {
      const obj = msg.toObject();
      obj.isDeletedForMe = msg.deletedFor?.some((id) => String(id) === String(userId));
      if (obj.isDeletedForMe) {
        obj.text = "[deleted]";
      }
      return obj;
    });

    return sendOk(res, 200, { messages: shaped });
  } catch (err) {
    console.error("[getMessages]", err);
    return sendError(res, 500, "Mesajlar alinmadi", "internal_error", err.message);
  }
}

export async function sendMessage(req, res) {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const senderId = req.user.sub;

    if (!text || !text.trim()) {
      return sendError(res, 400, "Mesaj icerigi bos olamaz", "validation_error");
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId,
    });
    if (!conversation) {
      return sendError(res, 404, "Sohbet bulunamadi veya yetkiniz yok", "conversation_not_found");
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      senderId,
      text: text.trim(),
      type: "TEXT",
      readBy: [senderId],
    });

    conversation.lastMessage = text.trim();
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    const populated = await message.populate("sender", "name email avatarUrl");

    if (io?.to) {
      // Emit to conversation room (for users already in the chat)
      io.to(`conv:${conversationId}`).emit("message:new", {
        _id: populated._id,
        conversationId: populated.conversationId,
        text: populated.text,
        type: populated.type,
        createdAt: populated.createdAt,
        sender: {
          _id: populated.sender._id,
          name: populated.sender.name,
          email: populated.sender.email,
          avatarUrl: populated.sender.avatarUrl,
        },
      });

      // Find receiver and send notification to their user room
      const receiverId = conversation.participants.find(
        (p) => String(p) !== String(senderId)
      );

      if (receiverId) {
        const receiverRoom = `user:${String(receiverId)}`;
        io.to(receiverRoom).emit("new_message", {
          conversationId: String(conversationId),
          message: populated.text,
          senderName: populated.sender?.name || "Bilinmeyen",
          timestamp: populated.createdAt,
        });
      }
    }

    return sendOk(res, 201, { message: populated });
  } catch (err) {
    console.error("[sendMessage]", err);
    return sendError(res, 500, "Mesaj gonderilemedi", "internal_error", err.message);
  }
}

// POST /api/conversations
export async function createOrGetConversation(req, res) {
  try {
    const userId = req.user.sub;
    let participantId = req.body?.participantId || req.body?.otherUserId;
    const relatedPetId = req.body?.relatedPetId || req.body?.advertId || req.body?.petId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 401, "Gecersiz oturum bilgisi", "auth_required");
    }
    if (relatedPetId && !mongoose.Types.ObjectId.isValid(relatedPetId)) {
      return sendError(res, 400, "Gecersiz ilan ID", "validation_error");
    }

    const relatedPetObjectId = relatedPetId ? new mongoose.Types.ObjectId(relatedPetId) : null;
    let petForContext = null;
    if (relatedPetObjectId) {
      petForContext = await Pet.findById(relatedPetObjectId).select("ownerId advertType");
      if (!petForContext) {
        return sendError(res, 404, "Ilan bulunamadi", "pet_not_found");
      }
    }

    if (!participantId && petForContext?.ownerId) {
      participantId = petForContext.ownerId.toString();
    }

    if (!participantId) return sendError(res, 400, "participantId gerekli", "validation_error");
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      return sendError(res, 400, "Gecersiz kullanici ID", "validation_error");
    }
    if (participantId === userId) return sendError(res, 400, "Kendinizle sohbet baslatamazsiniz", "validation_error");

    const currentUserObjectId = new mongoose.Types.ObjectId(userId);
    const participantObjectId = new mongoose.Types.ObjectId(participantId);

    let advertType = petForContext?.advertType || null;
    if (relatedPetId && !advertType && petForContext) {
      advertType = petForContext.advertType || null;
    }
    const contextType = advertType === "mating" ? "MATCHING" : advertType === "adoption" ? "ADOPTION" : null;

    const participantFilter = { participants: { $all: [currentUserObjectId, participantObjectId] } };

    let conversation = null;
    if (relatedPetObjectId) {
      conversation = await Conversation.findOne({ ...participantFilter, relatedPet: relatedPetObjectId });
      if (!conversation) {
        conversation = await Conversation.findOne({ ...participantFilter, relatedPet: null });
      }
    }
    if (!conversation) {
      conversation = await Conversation.findOne(participantFilter);
    }

    const defaultLastMessage = advertType === "mating" ? "Eslestirme saglandi" : "";

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserObjectId, participantObjectId],
        relatedPet: relatedPetObjectId,
        advertType,
        contextType,
        contextId: relatedPetObjectId,
        lastMessage: defaultLastMessage,
        lastMessageAt: defaultLastMessage ? new Date() : null,
      });
    } else if (relatedPetObjectId && !conversation.relatedPet) {
      conversation.relatedPet = relatedPetObjectId;
      if (!conversation.advertType && advertType) {
        conversation.advertType = advertType;
      }
      if (!conversation.contextType && contextType) {
        conversation.contextType = contextType;
      }
      if (!conversation.contextId && relatedPetObjectId) {
        conversation.contextId = relatedPetObjectId;
      }
      await conversation.save();
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "name avatarUrl email")
      .populate("relatedPet", "name photos images advertType");

    return sendOk(res, 200, { conversation: populated });
  } catch (err) {
    console.error("[createOrGetConversation]", err);
    return sendError(res, 500, "Sohbet baslatilamadi", "internal_error", err.message);
  }
}

export async function deleteConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const userId = req.user.sub;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return sendError(res, 404, "Sohbet bulunamadi veya yetkiniz yok", "conversation_not_found");
    }

    await Message.deleteMany({ conversationId });
    await conversation.deleteOne();

    return sendOk(res, 200, { deleted: true });
  } catch (err) {
    console.error("[deleteConversation]", err);
    return sendError(res, 500, "Sohbet silinemedi", "internal_error", err.message);
  }
}

// PATCH /api/conversations/:messageId/for-me
export async function deleteMessageForMe(req, res) {
  try {
    const { messageId } = req.params;
    const userId = req.user.sub;

    const message = await Message.findById(messageId);
    if (!message) return sendError(res, 404, "Mesaj bulunamadi", "message_not_found");

    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      participants: userId,
    });
    if (!conversation) {
      return sendError(res, 403, "Yetkiniz yok", "forbidden");
    }

    if (!message.deletedFor.some((id) => String(id) === String(userId))) {
      message.deletedFor.push(userId);
      await message.save();
    }

    await recordAudit("message.delete_for_me", {
      userId,
      entityType: "message",
      entityId: messageId,
      metadata: { conversationId: message.conversationId },
    });

    return sendOk(res, 200, { deleted: true });
  } catch (err) {
    console.error("[deleteMessageForMe]", err);
    return sendError(res, 500, "Mesaj silinemedi", "internal_error", err.message);
  }
}
