const mongoose = require("../db");

/** Snapshot of checkout delivery pin (Home / Office) for repeat orders */
const SavedDeliverySnapshotSchema = new mongoose.Schema(
  {
    fullAddress: { type: String, default: "" },
    latitude: { type: Number },
    longitude: { type: Number },
    landmark: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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

  /** Saved checkout addresses (updated when customer places order as Home or Office) */
  savedDeliveryAddresses: {
    home: { type: SavedDeliverySnapshotSchema },
    office: { type: SavedDeliverySnapshotSchema },
  },
  /** Last address-type chip used at checkout — drives default next time */
  lastCheckoutAddressType: {
    type: String,
    enum: ["home", "office", "other"],
    default: "home",
  },
});

module.exports = mongoose.model("User", UserSchema);