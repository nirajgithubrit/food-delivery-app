const { validationResult } = require("express-validator");
const ApiResponse = require("../utils/apiResponse");

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join("; ");
    return ApiResponse.fail(res, message, 422, { details: errors.array() });
  }
  next();
}

module.exports = validateRequest;
