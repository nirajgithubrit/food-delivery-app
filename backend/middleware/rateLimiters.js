const rateLimit = require("express-rate-limit");

/** General auth endpoints (login) */
exports.authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many attempts, try again later" } },
});

/** Stricter cap for admin registration */
exports.adminRegisterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many registrations from this network" } },
});
