const mongoose = require("../db");

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contactPhone: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  address: { type: String, default: "" },
  formattedAddress: { type: String, default: "" },
  category: { type: String, default: "" },
  description: { type: String, default: "" },
  logoUrl: { type: String, default: "" },
  bannerUrl: { type: String, default: "" },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  /** Quick toggle for “accepting orders” style UX */
  isOpen: { type: Boolean, default: true },
  /** Soft-disable tenant without deleting */
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

RestaurantSchema.index({ createdAt: 1 });

module.exports = mongoose.model("Restaurant", RestaurantSchema);
