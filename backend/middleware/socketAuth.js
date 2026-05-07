const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const config = require("../config");
const logger = require("../utils/logger");

function attachUserFromToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function createSocketAuthMiddleware() {
  return (socket, next) => {
    const headerToken = socket.handshake.auth?.token;
    const rawCookie = socket.handshake.headers?.cookie;
    const cookies = rawCookie ? cookie.parse(rawCookie) : {};
    const cookieToken = cookies.token;
    const token = headerToken || cookieToken;

    const user = attachUserFromToken(token);

    if (user) {
      socket.user = user;
      return next();
    }

    if (config.socketAuthOptional) {
      logger.warn({ msg: "Socket connected without auth (dev mode)", id: socket.id });
      socket.user = null;
      return next();
    }

    return next(new Error("Unauthorized"));
  };
}

module.exports = { createSocketAuthMiddleware, attachUserFromToken };
