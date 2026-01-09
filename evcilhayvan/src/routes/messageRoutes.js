// src/routes/messageRoutes.js
import { Router } from "express";
import { body, param } from "express-validator";
import { authRequired } from "../middlewares/auth.js";
import {
  getMyConversations,
  getConversationById,
  getMessages,
  sendMessage,
  createOrGetConversation,
  deleteConversation,
  deleteMessageForMe,
} from "../controllers/messageController.js";

const router = Router();

router.use(authRequired());

router.get("/", getMyConversations);
router.get("/me", getMyConversations);

router.get(
  "/:conversationId/messages",
  [param("conversationId").isMongoId().withMessage("Gecersiz Sohbet ID")],
  getMessages
);

router.get(
  "/:conversationId",
  [param("conversationId").isMongoId().withMessage("Gecersiz Sohbet ID")],
  getConversationById
);

router.post(
  "/:conversationId/messages",
  [
    param("conversationId").isMongoId().withMessage("Gecersiz Sohbet ID"),
    body("text").notEmpty().withMessage("Mesaj icerigi gerekli"),
  ],
  sendMessage
);

router.post(
  "/:conversationId",
  [
    param("conversationId").isMongoId().withMessage("Gecersiz Sohbet ID"),
    body("text").notEmpty().withMessage("Mesaj icerigi gerekli"),
  ],
  sendMessage
);

router.post(
  "/",
  [
    body("participantId").optional().isMongoId().withMessage("participantId gecersiz"),
    body("otherUserId").optional().isMongoId().withMessage("otherUserId gecersiz"),
    body("relatedPetId").optional().isMongoId().withMessage("relatedPetId gecersiz"),
    body("advertId").optional().isMongoId().withMessage("advertId gecersiz"),
  ],
  createOrGetConversation
);

router.delete(
  "/:conversationId",
  [param("conversationId").isMongoId().withMessage("Gecersiz Sohbet ID")],
  deleteConversation
);

router.patch(
  "/message/:messageId/for-me",
  [param("messageId").isMongoId().withMessage("Gecersiz Mesaj ID")],
  deleteMessageForMe
);

export default router;
