const bcrypt = require("bcryptjs");
const Restaurant = require("../models/restaurant");
const User = require("../models/user");
const ApiResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const config = require("../config");
const { getPrimaryRestaurantSnapshot } = require("../utils/restaurantResolve");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

async function uploadBuffer(buffer, folder) {
  if (!cloudinaryConfigured()) {
    throw new AppError("Image upload is not configured", 500);
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, uploaded) => {
        if (error) reject(error);
        else resolve(uploaded);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

exports.getMyRestaurant = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }

  if (req.user.restaurantId) {
    const r = await Restaurant.findById(req.user.restaurantId).lean();
    if (r) {
      return ApiResponse.success(res, { ...r, isLegacy: false });
    }
  }

  const snap = await getPrimaryRestaurantSnapshot();
  return ApiResponse.success(res, {
    _id: null,
    name: snap.name,
    contactPhone: snap.phone,
    location: { lat: snap.lat, lng: snap.lng },
    address: "",
    category: "",
    description: "",
    logoUrl: "",
    bannerUrl: "",
    formattedAddress: "",
    isOpen: true,
    isLegacy: true,
    message:
      "Using legacy env fallback. Complete restaurant registration for full profile management.",
  });
});

exports.updateMyRestaurant = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }
  const id = req.user.restaurantId;
  if (!id) {
    throw new AppError("No restaurant linked to this account", 400);
  }

  const r = await Restaurant.findById(id);
  if (!r) throw new AppError("Restaurant not found", 404);

  const b = req.body || {};
  const fields = [
    "name",
    "contactPhone",
    "email",
    "address",
    "formattedAddress",
    "category",
    "description",
    "isOpen",
  ];
  for (const f of fields) {
    if (b[f] !== undefined) {
      if (f === "isOpen") r[f] = Boolean(b[f]);
      else r[f] = String(b[f]).trim();
    }
  }
  if (b.lat !== undefined && b.lng !== undefined) {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      r.location = { lat, lng };
    }
  }

  await r.save();
  ApiResponse.success(res, r);
});

exports.updateRestaurantImages = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }
  const id = req.user.restaurantId;
  if (!id) throw new AppError("No restaurant linked", 400);

  const r = await Restaurant.findById(id);
  if (!r) throw new AppError("Restaurant not found", 404);

  const logo = req.files?.logo?.[0];
  const banner = req.files?.banner?.[0];
  if (logo) {
    const up = await uploadBuffer(logo.buffer, "food-delivery/restaurants/logos");
    r.logoUrl = up.secure_url;
  }
  if (banner) {
    const up = await uploadBuffer(banner.buffer, "food-delivery/restaurants/banners");
    r.bannerUrl = up.secure_url;
  }

  await r.save();
  ApiResponse.success(res, r);
});

exports.changeAdminPassword = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }
  if (req.user.id === "admin") {
    throw new AppError("Legacy admin cannot change password here", 400);
  }

  const { currentPassword, newPassword } = req.body || {};
  const cur = String(currentPassword || "");
  const next = String(newPassword || "");
  if (next.length < 8) {
    throw new AppError("New password must be at least 8 characters", 400);
  }

  const user = await User.findById(req.user.id);
  if (!user || !user.passwordHash) {
    throw new AppError("User not found", 404);
  }

  const ok = await bcrypt.compare(cur, user.passwordHash);
  if (!ok) throw new AppError("Current password is incorrect", 401);

  user.passwordHash = await bcrypt.hash(next, 12);
  await user.save();

  ApiResponse.success(res, { message: "Password updated" });
});
