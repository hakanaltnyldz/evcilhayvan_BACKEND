import crypto from "crypto";
import { validationResult } from "express-validator";
import User from "../models/User.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { issueTokens } from "../utils/tokens.js";
import { sendEmail } from "../utils/mail.js";
import { sendError, sendOk } from "../utils/apiResponse.js";

function buildUserPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    city: user.city,
    role: user.role,
    avatarUrl: user.avatarUrl,
    about: user.about,
    isSeller: user.isSeller === true || user.role === "seller",
  };
}

function validationFailure(res, errors) {
  return sendError(res, 400, "Doğrulama hatası", "validation_error", errors);
}

export async function refreshToken(req, res) {
  try {
    const tokenFromBody = req.body?.refreshToken || req.headers["x-refresh-token"];
    if (!tokenFromBody) {
      return sendError(res, 400, "Refresh token gerekli", "refresh_token_missing");
    }

    const user = await User.findOne({
      refreshToken: tokenFromBody,
      refreshTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return sendError(res, 401, "Geçersiz veya süresi dolmuş yenileme anahtarı", "invalid_refresh_token");
    }

    const tokens = await issueTokens(user);
    return sendOk(res, 200, { token: tokens.accessToken, refreshToken: tokens.refreshToken, user: buildUserPayload(user) });
  } catch (err) {
    return sendError(res, 500, "Token yenileme başarısız", "refresh_failed", err.message);
  }
}

// GET /api/auth/users
export async function getAllUsers(req, res) {
  try {
    const myId = req.user.sub;
    const users = await User.find({ _id: { $ne: myId } })
      .select("name email city avatarUrl role createdAt isSeller")
      .sort({ createdAt: -1 });

    return sendOk(res, 200, { users });
  } catch (err) {
    return sendError(res, 500, "Kullanıcılar alınamadı", "internal_error", err.message);
  }
}

export async function updateMe(req, res) {
  try {
    const { name, city, about } = req.body;
    const user = await User.findById(req.user.sub);
    if (!user) {
      return sendError(res, 404, "Kullanıcı bulunamadı", "user_not_found");
    }
    user.name = name || user.name;
    user.city = city || user.city;
    user.about = about || user.about;
    await user.save();
    return sendOk(res, 200, { user: buildUserPayload(user) });
  } catch (err) {
    return sendError(res, 500, "Profil güncellenemedi", "internal_error", err.message);
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, "Bu e-posta ile kayıtlı kullanıcı bulunamadı", "user_not_found");
    }
    const resetCode = user.createPasswordResetToken();
    await user.save();
    try {
      const emailHtml = `<h1>Şifre Sıfırlama İsteği</h1><p>6 haneli doğrulama kodunuz:</p><h2 style="color: #333; letter-spacing: 2px;">${resetCode}</h2><p>Bu kod 10 dakika geçerlidir.</p>`;
      await sendEmail(user.email, "Şifreni Sıfırla", emailHtml);
      return sendOk(res, 200, { message: "Şifre sıfırlama kodu e-postanıza gönderildi." });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      return sendError(res, 500, "E-posta gönderilemedi, lütfen tekrar deneyin.", "email_send_failed", err.message);
    }
  } catch (err) {
    return sendError(res, 500, "Şifre sıfırlama başarısız", "internal_error", err.message);
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({
      email,
      passwordResetToken: code,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return sendError(res, 400, "Şifre sıfırlama kodu geçersiz veya süresi dolmuş.", "invalid_reset_code");
    }
    user.password = await hashPassword(newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    return sendOk(res, 200, { message: "Şifreniz güncellendi. Şimdi giriş yapabilirsiniz." });
  } catch (err) {
    return sendError(res, 500, "Şifre sıfırlanamadı", "internal_error", err.message);
  }
}

export async function register(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailure(res, errors.array());
    }
    const { name, email, password, city } = req.body;
    let exists = await User.findOne({ email });
    if (exists && !exists.isVerified) {
      await User.deleteOne({ email });
    } else if (exists) {
      return sendError(res, 409, "Email zaten kayıtlı", "email_exists");
    }
    const user = new User({
      name,
      email,
      city,
      password: await hashPassword(password),
    });
    const verificationCode = user.createVerificationToken();
    await user.save();
    try {
      const emailHtml = `<h1>Evcil Hayvan Uygulamasına Hoş Geldin!</h1><p>Hesabını doğrulamak için 6 haneli kodun aşağıdadır:</p><h2 style="color: #333; letter-spacing: 2px;">${verificationCode}</h2><p>Bu kod 10 dakika geçerlidir.</p>`;
      await sendEmail(user.email, "Hesabını Doğrula", emailHtml);
    } catch (err) {
      return sendError(
        res,
        500,
        "Kullanıcı oluşturuldu ancak doğrulama e-postası gönderilemedi.",
        "email_send_failed",
        err.message
      );
    }
    return sendOk(res, 201, {
      message: "Kayıt başarılı! Lütfen e-postanıza gönderilen doğrulama kodunu girin.",
      email: user.email,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return sendError(res, 409, "Email zaten kayıtlı", "email_exists");
    }
    return sendError(res, 500, "Kayıt başarısız", "internal_error", err.message);
  }
}

export async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return sendError(res, 400, "Email ve doğrulama kodu gerekli", "validation_error");
    }
    const user = await User.findOne({
      email,
      verificationToken: code,
      verificationTokenExpires: { $gt: Date.now() },
    }).select("+verificationToken +verificationTokenExpires");

    if (!user) {
      return sendError(res, 400, "Doğrulama kodu geçersiz veya süresi dolmuş.", "invalid_verification_code");
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    const tokens = await issueTokens(user);
    return sendOk(res, 200, {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: buildUserPayload(user),
    });
  } catch (err) {
    return sendError(res, 500, "E-posta doğrulanamadı", "internal_error", err.message);
  }
}

export async function login(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return validationFailure(res, errors.array());
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return sendError(res, 401, "Geçersiz bilgiler", "invalid_credentials");
    const ok = await comparePassword(password, user.password);
    if (!ok) return sendError(res, 401, "Geçersiz bilgiler", "invalid_credentials");
    if (!user.isVerified) {
      return sendError(res, 403, "Hesabınız doğrulanmamış. Lütfen e-postanızı kontrol edin.", "email_not_verified", {
        email: user.email,
      });
    }
    const tokens = await issueTokens(user);
    return sendOk(res, 200, {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: buildUserPayload(user),
    });
  } catch (err) {
    return sendError(res, 500, "Giriş başarısız", "internal_error", err.message);
  }
}

export async function me(req, res) {
  const user = await User.findById(req.user.sub).select("name email role city about avatarUrl isSeller");
  if (!user) {
    return sendError(res, 404, "Kullanıcı bulunamadı", "user_not_found");
  }
  return sendOk(res, 200, { user: buildUserPayload(user) });
}

export async function uploadAvatar(req, res) {
  try {
    if (!req.file) {
      return sendError(res, 400, "Dosya gerekli", "file_required");
    }
    const user = await User.findById(req.user.sub);
    if (!user) {
      return sendError(res, 404, "Kullanıcı bulunamadı", "user_not_found");
    }
    const publicPath = `/uploads/${req.file.filename}`;
    user.avatarUrl = publicPath;
    await user.save();
    return sendOk(res, 200, {
      url: publicPath,
      user: buildUserPayload(user),
    });
  } catch (err) {
    return sendError(res, 500, "Profil fotoğrafı yüklenemedi", "internal_error", err.message);
  }
}

export async function loginWithGoogle(req, res) {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return sendError(res, 400, "Google idToken gerekli", "validation_error");
    }

    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );

    if (!tokenInfoResponse.ok) {
      return sendError(res, 401, "Geçersiz Google oturum bilgisi", "invalid_oauth_token");
    }

    const payload = await tokenInfoResponse.json();
    const audience = process.env.GOOGLE_CLIENT_ID;

    if (audience && payload.aud !== audience) {
      return sendError(res, 401, "Google istemcisi doğrulanamadı", "invalid_oauth_audience");
    }

    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return sendError(res, 401, "Google e-postası doğrulanmamış", "email_not_verified");
    }

    const email = payload.email?.toLowerCase();
    if (!email) {
      return sendError(res, 400, "Google e-postasına erişilemedi", "validation_error");
    }

    let user = await User.findOne({ email });
    const displayName = payload.name?.trim() || email.split("@")[0];
    const avatarUrl = payload.picture;

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = new User({
        name: displayName,
        email,
        password: await hashPassword(randomPassword),
        avatarUrl,
        isVerified: true,
      });
    } else {
      user.name = user.name || displayName;
      user.isVerified = true;
      if (!user.avatarUrl && avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
    }

    await user.save();
    const tokens = await issueTokens(user);

    return sendOk(res, 200, {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: buildUserPayload(user),
    });
  } catch (err) {
    return sendError(res, 500, "Google ile giriş yapılamadı", "internal_error", err.message);
  }
}

export async function loginWithFacebook(req, res) {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return sendError(res, 400, "Facebook accessToken gerekli", "validation_error");
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (appId && appSecret) {
      const debugResponse = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
          accessToken
        )}&access_token=${appId}|${appSecret}`
      );

      const debugJson = await debugResponse.json();
      const isValid = debugJson?.data?.is_valid;
      if (!isValid) {
        return sendError(res, 401, "Facebook oturumu doğrulanamadı", "invalid_oauth_token");
      }
    }

    const profileResponse = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
        accessToken
      )}`
    );

    if (!profileResponse.ok) {
      return sendError(res, 401, "Facebook profiline erişilemedi", "invalid_oauth_token");
    }

    const profile = await profileResponse.json();
    const email = profile.email?.toLowerCase();

    if (!email) {
      return sendError(res, 400, "Facebook hesabınız e-posta paylaşmadı. Lütfen e-posta izinlerini verin.", "validation_error");
    }

    let user = await User.findOne({ email });
    const displayName = profile.name?.trim() || email.split("@")[0];
    const avatarUrl = profile.picture?.data?.url;

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = new User({
        name: displayName,
        email,
        password: await hashPassword(randomPassword),
        avatarUrl,
        isVerified: true,
      });
    } else {
      user.name = user.name || displayName;
      user.isVerified = true;
      if (!user.avatarUrl && avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
    }

    await user.save();
    const tokens = await issueTokens(user);

    return sendOk(res, 200, {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: buildUserPayload(user),
    });
  } catch (err) {
    return sendError(res, 500, "Facebook ile giriş yapılamadı", "internal_error", err.message);
  }
}
