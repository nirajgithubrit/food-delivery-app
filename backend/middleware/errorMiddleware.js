const logger = require("../utils/logger");
const ApiResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

function notFound(req, res, next) {
  next(new AppError(`Not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err instanceof AppError || err.isOperational;
  const message =
    !isOperational && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  if (statusCode >= 500) {
    logger.error({
      msg: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn({ msg: err.message, path: req.originalUrl, method: req.method });
  }

  if (res.headersSent) {
    return next(err);
  }

  return ApiResponse.fail(res, message, statusCode);
}

module.exports = { notFound, errorHandler };
