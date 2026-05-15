const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const Restaurant = require("../models/restaurant");
const ApiResponse = require("../utils/apiResponse");
const config = require("../config");
const asyncHandler = require("../middleware/asyncHandler");
const AppError = require("../utils/AppError");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../services/token.service");
const { verifyFirebaseIdToken } = require("../utils/firebaseAdmin");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");

const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSecure ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const generateCustomerToken = (user) =>
  jwt.sign(
    { id: user._id.toString(), role: user.role },
    config.jwtSecret,
    { expiresIn: "7d" },
  );

function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

async function uploadRegisterImage(buffer, folder) {
  if (!cloudinaryConfigured()) return null;
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

exports.refreshTokens = asyncHandler(async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || "").trim();
  if (!refreshToken) {
    throw new AppError("Refresh token required", 400);
  }

  const decoded = verifyRefreshToken(refreshToken);

  const user = await User.findById(decoded.id).populate("restaurantId");
  if (!user) {
    throw new AppError("User not found", 401);
  }

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);

  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? "none" : "lax",
    maxAge: config.jwtAccessMaxAgeMs,
  });

  ApiResponse.success(res, {
    message: "Token refreshed",
    token: accessToken,
    refreshToken: newRefresh,
    role: user.role,
  });
});

exports.adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
    role: "admin",
  }).populate("restaurantId");

  if (user && user.passwordHash) {
    const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
    if (!ok) {
      return ApiResponse.fail(res, "Invalid credentials", 401);
    }

    const rest = user.restaurantId;
    const restId = rest && rest._id ? rest._id : user.restaurantId;

    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: "admin",
        restaurantId: restId ? String(restId) : null,
      },
      config.jwtSecret,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, cookieOptions);

    return ApiResponse.success(res, {
      message: "Admin login success",
      role: "admin",
      token,
      restaurantId: restId ? String(restId) : null,
      restaurantName: rest && rest.name ? rest.name : null,
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "123456";

  if (normalizedEmail === String(adminEmail).toLowerCase() && password === adminPassword) {
    const token = jwt.sign(
      { id: "admin", role: "admin", restaurantId: null },
      config.jwtSecret,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, cookieOptions);

    return ApiResponse.success(res, {
      message: "Admin login success",
      role: "admin",
      token,
      restaurantId: null,
      restaurantName: null,
      legacyEnvLogin: true,
    });
  }

  return ApiResponse.fail(res, "Invalid credentials", 401);
});

exports.registerAdmin = asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");
  const restaurantName = String(req.body.restaurantName || "").trim();
  const restaurantContact = String(req.body.restaurantContact || "").trim();
  const restaurantAddress = String(req.body.restaurantAddress || "").trim();
  const category = String(req.body.category || "").trim();
  const description = String(req.body.description || "").trim();
  const formattedAddress = String(req.body.formattedAddress || "").trim();
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);

  if (username.length < 2) throw new AppError("Username is required", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Valid email is required", 400);
  }
  if (password.length < 8) throw new AppError("Password must be at least 8 characters", 400);
  if (password !== confirmPassword) throw new AppError("Passwords do not match", 400);
  if (restaurantName.length < 2) throw new AppError("Restaurant name is required", 400);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError("Pick a location on the map", 400);
  }

  const dup = await User.findOne({ email });
  if (dup) throw new AppError("Email already registered", 409);

  let logoUrl = "";
  let bannerUrl = "";

  const logoFile = req.files?.logo?.[0];
  const bannerFile = req.files?.banner?.[0];

  if (logoFile) {
    const up = await uploadRegisterImage(logoFile.buffer, "food-delivery/restaurants/logos");
    if (up?.secure_url) logoUrl = up.secure_url;
  }
  if (bannerFile) {
    const up = await uploadRegisterImage(bannerFile.buffer, "food-delivery/restaurants/banners");
    if (up?.secure_url) bannerUrl = up.secure_url;
  }

  const restaurant = await Restaurant.create({
    name: restaurantName,
    contactPhone: restaurantContact,
    email,
    address: restaurantAddress,
    formattedAddress,
    category,
    description,
    logoUrl,
    bannerUrl,
    location: { lat, lng },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    username,
    email,
    passwordHash,
    role: "admin",
    restaurantId: restaurant._id,
    name: username,
  });

  const token = jwt.sign(
    {
      id: user._id.toString(),
      role: "admin",
      restaurantId: String(restaurant._id),
    },
    config.jwtSecret,
    { expiresIn: "7d" },
  );

  res.cookie("token", token, cookieOptions);

  ApiResponse.success(
    res,
    {
      message: "Restaurant account created",
      role: "admin",
      token,
      restaurantId: String(restaurant._id),
      restaurant,
    },
    201,
  );
});

exports.deliveryLogin = asyncHandler(async (req, res) => {
  const phone = String(req.body?.phone || "").trim();
  const name = String(req.body?.name || "").trim();

  if (!phone) {
    throw new AppError("Phone is required", 400);
  }
  if (!name) {
    throw new AppError("Name is required", 400);
  }

  let user = await User.findOne({ phone, role: "delivery" });

  if (!user) {
    user = await User.create({ phone, name, role: "delivery" });
  } else if (user.name !== name) {
    user.name = name;
    await user.save();
  }

  const token = generateCustomerToken(user);

  res.cookie("token", token, cookieOptions);

  ApiResponse.success(res, {
    message: "Delivery login success",
    role: user.role,
    token,
    user,
  });
});

function normalizePhone10(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

exports.firebaseLogin = asyncHandler(async (req, res) => {
  const firebaseToken = String(req.body?.firebaseToken || "").trim();
  const mobileHint = String(req.body?.mobile || "").trim();
  if (!firebaseToken) {
    throw new AppError("Firebase token is required", 400);
  }

  const decoded = await verifyFirebaseIdToken(firebaseToken);
  const firebasePhone = String(decoded.phone_number || "").trim();
  const phone = normalizePhone10(firebasePhone || mobileHint);

  if (!/^\d{10}$/.test(phone)) {
    throw new AppError("Valid phone number not found in verified Firebase token", 401);
  }

  let user = await User.findOne({ phone, role: "customer" });
  if (!user) {
    user = await User.create({ phone, role: "customer" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  res.cookie("token", accessToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? "none" : "lax",
    maxAge: config.jwtAccessMaxAgeMs,
  });

  ApiResponse.success(res, {
    message: "Firebase login success",
    token: accessToken,
    refreshToken,
    role: user.role,
    user: {
      id: user._id,
      role: user.role,
      phone: user.phone,
    },
  });
});

/** Customer: saved Home/Office delivery snapshots + last chip used at checkout */
exports.getSavedDeliveryAddresses = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user.id)
    .select("savedDeliveryAddresses lastCheckoutAddressType")
    .lean();
  if (!u) throw new AppError("User not found", 404);
  ApiResponse.success(res, {
    savedDeliveryAddresses: u.savedDeliveryAddresses || {},
    lastCheckoutAddressType: u.lastCheckoutAddressType || "home",
  });
});

exports.getMe = (req, res) => {
  ApiResponse.success(res, req.user);
};

exports.logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSecure ? "none" : "lax",
  });
  ApiResponse.success(res, { message: "Logged out" });
};
