const jwt = require("jsonwebtoken");
const User = require("../models/user");
const ApiResponse = require("../utils/apiResponse");
const config = require("../config");

const generateToken = (user) => {
  const payload = { id: user._id.toString(), role: user.role };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
};

const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSecure ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

exports.customerLogin = async (req, res) => {
  const { phone } = req.body;

  let user = await User.findOne({ phone });

  if (!user) {
    user = await User.create({ phone, role: "customer" });
  }

  const token = generateToken(user);

  res.cookie("token", token, cookieOptions);

  ApiResponse.success(res, {
    message: "Customer login success",
    role: user.role,
    token,
    user: { id: user._id, role: user.role, phone: user.phone },
  });
};

exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "123456";

  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign(
      { id: "admin", role: "admin" },
      config.jwtSecret,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, cookieOptions);

    return ApiResponse.success(res, {
      message: "Admin login success",
      role: "admin",
      token,
    });
  }

  return ApiResponse.fail(res, "Invalid credentials", 401);
};

exports.deliveryLogin = async (req, res) => {
  const { phone } = req.body;

  let user = await User.findOne({ phone, role: "delivery" });

  if (!user) {
    user = await User.create({ phone, role: "delivery" });
  }

  const token = generateToken(user);

  res.cookie("token", token, cookieOptions);

  ApiResponse.success(res, {
    message: "Delivery login success",
    role: user.role,
    token,
    user,
  });
};

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
