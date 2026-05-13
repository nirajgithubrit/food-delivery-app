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

const { notifyUserById } = require("../services/pushNotification.service");

/** Admin-only smoke test for FCM delivery to the signed-in admin device. */
exports.sendTestPush = asyncHandler(async (req, res) => {
  const id = String(req.user?.id || "");
  if (!/^[a-f0-9A-F]{24}$/.test(id)) {
    throw new AppError("Push test requires a valid admin session.", 400);
  }

  await notifyUserById(
    id,
    { title: "Test notification", body: "FCM delivery test from the server." },
    { type: "push_test", click_path: "/admin/orders" },
  );

  ApiResponse.success(res, { sent: true });
});
