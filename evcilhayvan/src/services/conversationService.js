import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";

function advertTypeForContext(contextType) {
  if (contextType === "MATCHING") return "mating";
  if (contextType === "ADOPTION") return "adoption";
  return null;
}

async function findExistingConversation(participants, contextType, contextId) {
  const participantFilter = { participants: { $all: participants } };
  if (contextType && contextId) {
    const byContext = await Conversation.findOne({ ...participantFilter, contextType, contextId });
    if (byContext) return byContext;
  }
  if (contextId) {
    const byRelated = await Conversation.findOne({ ...participantFilter, relatedPet: contextId });
    if (byRelated) return byRelated;
  }
  return Conversation.findOne(participantFilter);
}

export async function ensureConversationWithSystemMessage({
  fromUserId,
  toUserId,
  contextType,
  contextId,
  systemText,
  actorId,
}) {
  const participants = [fromUserId, toUserId];
  let conversation = await findExistingConversation(participants, contextType, contextId);

  const advertType = advertTypeForContext(contextType);
  const now = new Date();

  if (!conversation) {
    conversation = await Conversation.create({
      participants,
      contextType,
      contextId,
      relatedPet: contextId || null,
      advertType,
      lastMessage: systemText,
      lastMessageAt: now,
    });
  } else {
    let dirty = false;
    if (!conversation.contextType && contextType) {
      conversation.contextType = contextType;
      dirty = true;
    }
    if (!conversation.contextId && contextId) {
      conversation.contextId = contextId;
      dirty = true;
    }
    if (!conversation.relatedPet && contextId) {
      conversation.relatedPet = contextId;
      dirty = true;
    }
    if (!conversation.advertType && advertType) {
      conversation.advertType = advertType;
      dirty = true;
    }
    conversation.lastMessage = systemText;
    conversation.lastMessageAt = now;
    dirty = true;
    if (dirty) await conversation.save();
  }

  const senderId = actorId || toUserId;
  const message = await Message.create({
    conversationId: conversation._id,
    sender: senderId,
    senderId,
    text: systemText,
    type: "SYSTEM",
    readBy: [],
  });

  return { conversation, message };
}
