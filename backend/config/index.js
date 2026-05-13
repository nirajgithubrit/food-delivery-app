const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function parseOrigins(raw) {
  if (!raw || typeof raw !== "string") {
    return ["http://localhost:4200"];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);

const nodeEnv = process.env.NODE_ENV || "development";

const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/** Cookie max-age for access JWT (ms) — keep in sync with JWT_ACCESS_EXPIRES_IN */
function accessMaxAgeMsFromEnv() {
  const raw = process.env.JWT_ACCESS_MAX_AGE_MS;
  if (raw && Number(raw) > 0) return Number(raw);
  return 15 * 60 * 1000;
}

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/localbite",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "change-refresh-in-production",
  jwtAccessExpiresIn,
  jwtRefreshExpiresIn,
  jwtAccessMaxAgeMs: accessMaxAgeMsFromEnv(),
  allowedOrigins,
  /** Absolute site URL for FCM `click_url` / Web Push links (no trailing slash). */
  publicWebOrigin: (process.env.PUBLIC_WEB_ORIGIN || "").trim().replace(/\/+$/, "") || allowedOrigins[0] || "",
  cookieSecure: process.env.COOKIE_SECURE === "true" || nodeEnv === "production",
  socketAuthOptional: process.env.SOCKET_AUTH_OPTIONAL === "true" || nodeEnv === "development",
  /**
   * Legacy fallback when no `Restaurant` document exists yet.
   * Prefer DB-driven profile via admin registration.
   */
  restaurant: {
    lat: Number(process.env.RESTAURANT_LAT) || 22.721585,
    lng: Number(process.env.RESTAURANT_LNG) || 71.647064,
    name: process.env.RESTAURANT_NAME || "Gir Gamthi",
    phone: process.env.RESTAURANT_PHONE || "+918155012096",
  },
};
