const jwt = require("jsonwebtoken");
const ApiResponse = require("../utils/apiResponse");
const config = require("../config");

exports.protect = (req, res, next) => {
  const token = req.cookies?.token;

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
