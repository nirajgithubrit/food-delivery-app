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

const nodeEnv = process.env.NODE_ENV || "development";

module.exports = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/localbite",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  cookieSecure: process.env.COOKIE_SECURE === "true" || nodeEnv === "production",
  socketAuthOptional: process.env.SOCKET_AUTH_OPTIONAL === "true" || nodeEnv === "development",
  restaurant: {
    lat: Number(process.env.RESTAURANT_LAT) || 22.721585,
    lng: Number(process.env.RESTAURANT_LNG) || 71.647064,
  },
};
