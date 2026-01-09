import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { listAuditLogs } from "../controllers/auditController.js";

const router = Router();

router.get("/audit-logs", authRequired(["admin"]), listAuditLogs);

export default router;
