const jwt = require("jsonwebtoken");
const User = require("../models/user");

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, "SECRET_KEY", {
    expiresIn: "7d",
  });
};

// 📱 CUSTOMER LOGIN (OTP SIMULATION)
exports.customerLogin = async (req, res) => {
  const { phone } = req.body;

  let user = await User.findOne({ phone });

  if (!user) {
    user = await User.create({ phone, role: "customer" });
  }

  const token = generateToken(user);

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  res.send({ message: "Customer login success", role: user.role });
};

// 🧑‍💼 ADMIN LOGIN
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (email === "admin@gmail.com" && password === "123456") {
    const token = jwt.sign({ role: "admin" }, "SECRET_KEY", {
      expiresIn: "7d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    return res.send({ message: "Admin login success", role: "admin" });
  }

  res.status(401).send({ message: "Invalid credentials" });
};

// 🛵 DELIVERY LOGIN
exports.deliveryLogin = async (req, res) => {
  const { phone } = req.body;

  let user = await User.findOne({ phone, role: "delivery" });

  if (!user) {
    user = await User.create({ phone, role: "delivery" });
  }

  const token = jwt.sign({ id: user._id, role: "delivery" }, "SECRET_KEY", {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  res.send({ message: "Delivery login success", user });
};

// GET CURRENT USER
exports.getMe = (req, res) => {
  res.send(req.user);
};

// 🚪 LOGOUT
exports.logout = (req, res) => {
  res.clearCookie("token");
  res.send({ message: "Logged out" });
};
