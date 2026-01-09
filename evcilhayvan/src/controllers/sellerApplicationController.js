import SellerApplication from "../models/SellerApplication.js";
import SellerProfile from "../models/SellerProfile.js";
import User from "../models/User.js";
import { sendError, sendOk } from "../utils/apiResponse.js";
import { recordAudit } from "../utils/audit.js";

export async function applySeller(req, res) {
  try {
    const userId = req.user?.sub;
    if (!userId) return sendError(res, 401, "Kimlik dogrulama gerekli", "auth_required");

    const existing = await SellerApplication.findOne({ user: userId, status: "pending" });
    if (existing) {
      return sendError(res, 400, "Basvurunuz zaten beklemede", "application_exists", existing);
    }

    const application = await SellerApplication.create({ user: userId, ...req.body, status: "pending" });

    await recordAudit("seller_application.create", {
      userId,
      entityType: "seller_application",
      entityId: application._id.toString(),
    });

    return sendOk(res, 201, { application });
  } catch (err) {
    console.error("[applySeller] error", err);
    return sendError(res, 500, "Basvuru olusturulamadi", "internal_error", err.message);
  }
}

export async function listSellerApplications(_req, res) {
  try {
    const apps = await SellerApplication.find().populate("user", "name email role");
    return sendOk(res, 200, { applications: apps });
  } catch (err) {
    console.error("[listSellerApplications] error", err);
    return sendError(res, 500, "Basvurular getirilemedi", "internal_error", err.message);
  }
}

async function updateApplicationStatus(req, res, status) {
  try {
    const { id } = req.params;
    const application = await SellerApplication.findById(id);
    if (!application) return sendError(res, 404, "Basvuru bulunamadi", "application_not_found");

    application.status = status;
    application.rejectionReason = status === "rejected" ? req.body?.rejectionReason : undefined;
    await application.save();

    if (status === "approved") {
      const user = await User.findById(application.user);
      if (user) {
        user.role = "seller";
        user.isSeller = true;
        await user.save();
      }

      await SellerProfile.findOneAndUpdate(
        { user: application.user },
        {
          storeName: application.companyName,
          storeDescription: "",
          storeLogo: "",
        },
        { upsert: true, new: true }
      );
    }

    await recordAudit("seller_application.update", {
      userId: req.user?.sub,
      entityType: "seller_application",
      entityId: id,
      metadata: { status },
    });

    return sendOk(res, 200, { application });
  } catch (err) {
    console.error("[updateApplicationStatus] error", err);
    return sendError(res, 500, "Islem basarisiz", "internal_error", err.message);
  }
}

export function approveApplication(req, res) {
  return updateApplicationStatus(req, res, "approved");
}

export function rejectApplication(req, res) {
  return updateApplicationStatus(req, res, "rejected");
}
