import AuditLog from "../models/AuditLog.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

export async function listAuditLogs(req, res) {
  try {
    const { limit = 50, action } = req.query;
    const filter = {};
    if (action) filter.action = action;

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    return sendOk(res, 200, { logs });
  } catch (err) {
    return sendError(res, 500, "Audit logları alınamadı", "internal_error", err.message);
  }
}
