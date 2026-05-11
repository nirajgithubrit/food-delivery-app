const mongoose = require("../db");

const UserSchema = new mongoose.Schema({
  phone: { type: String, default: "", trim: true },
  name: { type: String, default: "" },
  role: { type: String, default: "customer" },

  /** Admin workspace login */
  username: { type: String, default: "", trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    unique: true,
  },
  passwordHash: { type: String, default: "" },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null,
  },

  isAvailable: { type: Boolean, default: true },

  location: {
    lat: Number,
    lng: Number,
  },

  /** Web FCM device tokens (deduped in app logic) */
  fcmTokens: { type: [String], default: [] },
});

module.exports = mongoose.model("User", UserSchema);