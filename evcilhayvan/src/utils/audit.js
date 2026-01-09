import AuditLog from "../models/AuditLog.js";

export async function recordAudit(action, { userId, entityType, entityId, metadata } = {}) {
  try {
    await AuditLog.create({
      action,
      user: userId || null,
      entityType: entityType || null,
      entityId: entityId || null,
      metadata: metadata || undefined,
    });
  } catch (err) {
    console.error("[audit] unable to record audit log", action, err.message);
  }
}
