const User = require("../models/user");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/AppError");

exports.registerFcmToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) throw new AppError("FCM token is required", 400);

  const id = String(req.user?.id || "");
  if (!/^[a-f0-9A-F]{24}$/.test(id)) {
    return ApiResponse.success(res, { registered: false, reason: "legacy-session" });
  }

  await User.findByIdAndUpdate(id, { $addToSet: { fcmTokens: token } });

  ApiResponse.success(res, { registered: true });
});

exports.removeFcmToken = asyncHandler(async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) throw new AppError("FCM token is required", 400);

  const id = String(req.user?.id || "");
  if (!/^[a-f0-9A-F]{24}$/.test(id)) {
    return ApiResponse.success(res, { removed: false });
  }

  await User.findByIdAndUpdate(id, { $pull: { fcmTokens: token } });

  ApiResponse.success(res, { removed: true });
});
