// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import path from "path";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./src/config/config.js";
import { attachResponseHelpers, errorHandler } from "./src/utils/apiResponse.js";

// Routes
import authRoutes from "./src/routes/authRoutes.js";
import petRoutes from "./src/routes/petRoutes.js";
import advertRoutes from "./src/routes/advertRoutes.js";
import interactionRoutes from "./src/routes/interactionRoutes.js";
import messageRoutes from "./src/routes/messageRoutes.js";
import matchingRoutes from "./src/routes/matchingRoutes.js";
import matchRequestRoutes from "./src/routes/matchRequestRoutes.js";
import adoptionApplicationRoutes from "./src/routes/adoptionApplicationRoutes.js";
import storeRoutes from "./src/routes/storeRoutes.js";
import sellerRoutes from "./src/routes/sellerRoutes.js";
import adminSellerRoutes from "./src/routes/adminSellerRoutes.js";
import storeFrontRoutes from "./src/routes/storeFrontRoutes.js";
import myAdvertRoutes from "./src/routes/myAdvertRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import auditRoutes from "./src/routes/auditRoutes.js";
import testSocketRoutes from "./src/routes/testSocketRoutes.js";
import favoriteRoutes from "./src/routes/favoriteRoutes.js";
import reviewRoutes from "./src/routes/reviewRoutes.js";
import couponRoutes from "./src/routes/couponRoutes.js";

export const app = express();
export const httpServer = createServer(app);

// --- Socket.io ---
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

// User-Socket mapping: userId -> Set of socketIds (user can have multiple connections)
export const userSocketMap = new Map();

// Helper function to get socket IDs for a user
export function getSocketsByUserId(userId) {
  return userSocketMap.get(String(userId)) || new Set();
}

// Helper function to check if user is online
export function isUserOnline(userId) {
  const sockets = userSocketMap.get(String(userId));
  return sockets && sockets.size > 0;
}

// Middlewares
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(helmet());
app.use(morgan("dev"));
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.charset = "utf-8";
  next();
});
app.use(attachResponseHelpers);

// Static
const __dirname = path.resolve(path.dirname(""));
const uploadStaticPath = path.isAbsolute(config.uploadDir)
  ? config.uploadDir
  : path.join(__dirname, config.uploadDir);
app.use("/uploads", express.static(uploadStaticPath));

// Health
app.get("/api/health", (_req, res) => res.sendOk({ ok: true }));
app.get("/api/utf8-test", (_req, res) =>
  res.json({
    city: "İstanbul",
    match: "Eşleştirme",
    adopt: "Sahiplendirme",
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/adverts", advertRoutes);
app.use("/api/interactions", interactionRoutes);
app.use("/api/conversations", messageRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/matches", matchRequestRoutes);
app.use("/api/adoption-applications", adoptionApplicationRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/store", storeRoutes);
app.use("/api", sellerRoutes);
app.use("/api", adminSellerRoutes);
app.use("/api", storeFrontRoutes);
app.use("/api/my-adverts", myAdvertRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admin", auditRoutes);
app.use("/api/test", testSocketRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api", reviewRoutes);
app.use("/api", couponRoutes);

// Error handler (keep last)
app.use(errorHandler);

// DB & Server
export async function startServer() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("MongoDB connected");
    httpServer.listen(config.port, "0.0.0.0", () => {
      console.log(`Server listening on 0.0.0.0:${config.port}`);
    });
  } catch (err) {
    console.error("Mongo connection error:", err.message);
    process.exit(1);
  }
}

if (config.env !== "test") {
  startServer();
}

// Socket handlers
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Store the userId associated with this socket for cleanup on disconnect
  let connectedUserId = null;

  socket.on("join:user", (userId) => {
    if (!userId) return;

    const userIdStr = String(userId);
    connectedUserId = userIdStr;

    // Add socket to user's socket set
    if (!userSocketMap.has(userIdStr)) {
      userSocketMap.set(userIdStr, new Set());
    }
    userSocketMap.get(userIdStr).add(socket.id);

    // Join user room
    socket.join(`user:${userIdStr}`);

    console.log(`User ${userIdStr} joined with socket ${socket.id}. Total connections: ${userSocketMap.get(userIdStr).size}`);
  });

  socket.on("join:conversation", (conversationId) => {
    if (!conversationId) return;
    socket.join(`conv:${conversationId}`);
  });

  socket.on("leave:conversation", (conversationId) => {
    if (!conversationId) return;
    socket.leave(`conv:${conversationId}`);
  });

  socket.on("sendMessage", (payload) => {
    const { conversationId } = payload || {};
    if (!conversationId) return;
    io.to(`conv:${conversationId}`).emit("message:new", payload?.message ?? payload);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    // Clean up user-socket mapping
    if (connectedUserId) {
      const userSockets = userSocketMap.get(connectedUserId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // Remove user from map if no more connections
        if (userSockets.size === 0) {
          userSocketMap.delete(connectedUserId);
          console.log(`User ${connectedUserId} is now offline`);
        } else {
          console.log(`User ${connectedUserId} still has ${userSockets.size} connection(s)`);
        }
      }
    }
  });
});
