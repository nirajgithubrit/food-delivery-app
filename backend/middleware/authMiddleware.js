const jwt = require("jsonwebtoken");
const ApiResponse = require("../utils/apiResponse");
const config = require("../config");

function getTokenFromRequest(req) {
  const cookieToken = req.cookies?.token;
  if (cookieToken) return cookieToken;

  const raw = req.headers?.authorization;
  if (typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

exports.protect = (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return ApiResponse.fail(res, "Not authorized", 401);
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch {
    return ApiResponse.fail(res, "Invalid or expired token", 401);
  }
};

exports.authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return ApiResponse.fail(res, "Access denied", 403);
    }
    next();
  };
