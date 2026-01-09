import { Router } from "express";

import { authRequired } from "../middlewares/auth.js";
import {
  getMatchingProfiles,
  createMatchRequest,
  getInboxRequests,
  getOutboxRequests,
  sendMatchRequest,
  updateMatchRequestStatus,
} from "../controllers/matchingController.js";

const router = Router();

router.use(authRequired());

router.get("/profiles", getMatchingProfiles);
router.post("/request/:profileId", sendMatchRequest);
router.post("/requests", createMatchRequest);
router.get("/requests/inbox", getInboxRequests);
router.get("/requests/outbox", getOutboxRequests);
router.patch("/requests/:id", updateMatchRequestStatus);

export default router;
