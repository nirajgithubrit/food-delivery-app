const jwt = require("jsonwebtoken");
const config = require("../config");
const AppError = require("../utils/AppError");

function signAccessToken(user) {
  const payload = { id: user._id.toString(), role: user.role };
  if (user.role === "admin") {
    const rid = user.restaurantId?._id || user.restaurantId;
    if (rid) payload.restaurantId = String(rid);
  }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessExpiresIn });
}

function signRefreshToken(user) {
  const payload = { id: user._id.toString(), role: user.role, typ: "refresh" };
  if (user.role === "admin") {
    const rid = user.restaurantId?._id || user.restaurantId;
    if (rid) payload.restaurantId = String(rid);
  }
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });
}

function verifyRefreshToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwtRefreshSecret);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
  if (decoded.typ !== "refresh") {
    throw new AppError("Invalid refresh token", 401);
  }
  return decoded;
}

module.exports = { signAccessToken, signRefreshToken, verifyRefreshToken };
