// src/routes/testSocketRoutes.js
import express from "express";
import { io, userSocketMap, isUserOnline } from "../../server.js";
import { authRequired } from "../middlewares/auth.js";

const router = express.Router();

// Test match_request emit
// POST /api/test/socket/match-request
router.post("/socket/match-request", authRequired(), (req, res) => {
  try {
    const { targetUserId, requestId, senderName, senderPetName, senderPetImage, fromAdvertId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId gerekli" });
    }

    const userRoom = `user:${targetUserId}`;

    io.to(userRoom).emit("match_request", {
      requestId: requestId || "test-request-id",
      senderName: senderName || "Test Kullanici",
      senderPetName: senderPetName || "Test Pet",
      senderPetImage: senderPetImage || null,
      fromAdvertId: fromAdvertId || "test-advert-id",
    });

    return res.json({
      success: true,
      message: `match_request eventi ${userRoom} odasina gonderildi`,
      isUserOnline: isUserOnline(targetUserId),
    });
  } catch (err) {
    console.error("[testMatchRequest]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Test match_accepted emit
// POST /api/test/socket/match-accepted
router.post("/socket/match-accepted", authRequired(), (req, res) => {
  try {
    const { targetUserId, conversationId, matchRequestId, partnerName, partnerPetName } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId gerekli" });
    }

    const userRoom = `user:${targetUserId}`;

    io.to(userRoom).emit("match_accepted", {
      conversationId: conversationId || "test-conversation-id",
      matchRequestId: matchRequestId || "test-request-id",
      partnerName: partnerName || "Test Partner",
      partnerPetName: partnerPetName || "Test Partner Pet",
    });

    return res.json({
      success: true,
      message: `match_accepted eventi ${userRoom} odasina gonderildi`,
      isUserOnline: isUserOnline(targetUserId),
    });
  } catch (err) {
    console.error("[testMatchAccepted]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Test match_rejected emit
// POST /api/test/socket/match-rejected
router.post("/socket/match-rejected", authRequired(), (req, res) => {
  try {
    const { targetUserId, matchRequestId, rejectorName } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId gerekli" });
    }

    const userRoom = `user:${targetUserId}`;

    io.to(userRoom).emit("match_rejected", {
      matchRequestId: matchRequestId || "test-request-id",
      rejectorName: rejectorName || "Test Kullanici",
    });

    return res.json({
      success: true,
      message: `match_rejected eventi ${userRoom} odasina gonderildi`,
      isUserOnline: isUserOnline(targetUserId),
    });
  } catch (err) {
    console.error("[testMatchRejected]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Test new_message emit
// POST /api/test/socket/new-message
router.post("/socket/new-message", authRequired(), (req, res) => {
  try {
    const { targetUserId, conversationId, message, senderName } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: "targetUserId gerekli" });
    }

    const userRoom = `user:${targetUserId}`;

    io.to(userRoom).emit("new_message", {
      conversationId: conversationId || "test-conversation-id",
      message: message || "Test mesaji",
      senderName: senderName || "Test Gonderen",
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `new_message eventi ${userRoom} odasina gonderildi`,
      isUserOnline: isUserOnline(targetUserId),
    });
  } catch (err) {
    console.error("[testNewMessage]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get connected users
// GET /api/test/socket/users
router.get("/socket/users", authRequired(), (req, res) => {
  try {
    const users = [];
    userSocketMap.forEach((sockets, odId) => {
      users.push({
        odId,
        socketCount: sockets.size,
        socketIds: Array.from(sockets),
      });
    });

    return res.json({
      success: true,
      connectedUsers: users.length,
      users,
    });
  } catch (err) {
    console.error("[getConnectedUsers]", err);
    return res.status(500).json({ error: err.message });
  }
});

// Check if specific user is online
// GET /api/test/socket/user/:userId/status
router.get("/socket/user/:userId/status", authRequired(), (req, res) => {
  try {
    const { userId } = req.params;
    const online = isUserOnline(userId);
    const sockets = userSocketMap.get(userId);

    return res.json({
      success: true,
      userId,
      isOnline: online,
      socketCount: sockets ? sockets.size : 0,
      socketIds: sockets ? Array.from(sockets) : [],
    });
  } catch (err) {
    console.error("[getUserStatus]", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
