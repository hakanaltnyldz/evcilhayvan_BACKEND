import { verifyToken } from "../utils/jwt.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * Rol bazlı auth middleware
 * @param {Array<string>} allowedRoles
 */
export function authRequired(allowedRoles = []) {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[Auth] ${req.method} ${req.path}`);
    }

    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

    if (!token) {
      return sendError(res, 401, "Token gerekli", "auth_required");
    }

    try {
      const payload = verifyToken(token);
      req.user = payload;

      // Rol kontrolü
      if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
        return sendError(
          res,
          403,
          "Erişim reddedildi. Bu işlem için yetkiniz yok.",
          "forbidden"
        );
      }

      next();
    } catch (err) {
      return sendError(
        res,
        401,
        `Geçersiz veya süresi dolmuş token: ${err.message}`,
        "invalid_token"
      );
    }
  };
}

// Basit auth middleware (rol kontrolü olmadan)
export const protect = (req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[Auth] ${req.method} ${req.path}`);
  }

  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

  if (!token) {
    return sendError(res, 401, "Token gerekli", "auth_required");
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return sendError(
      res,
      401,
      `Geçersiz veya süresi dolmuş token: ${err.message}`,
      "invalid_token"
    );
  }
};
