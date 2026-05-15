const mongoose = require("../db");

const OrderSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  items: { type: Array, default: [] },
  totalAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: [
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "rejected",
    ],
    default: "pending",
    index: true,
  },
  location: {
    lat: Number,
    lng: Number,
  },
  /** Exact drop-off chosen at checkout (text + coordinates). `location` mirrors lat/lng for legacy clients. */
  deliveryAddress: {
    fullAddress: { type: String, default: "" },
    latitude: { type: Number },
    longitude: { type: Number },
    landmark: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    addressType: {
      type: String,
      enum: ["home", "office", "other"],
      default: "other",
    },
  },
  deliveryBoyId: { type: String, default: null, index: true },
  deliveryLocation: {
    lat: Number,
    lng: Number,
  },
  restaurantLocation: {
    lat: Number,
    lng: Number,
  },
  /** Snapshot at order time (tracking + sockets); falls back to config in API if missing */
  restaurantName: { type: String, default: "" },
  restaurantPhone: { type: String, default: "" },
  pickupStatus: {
    type: String,
    enum: ["pending", "picked"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["cod", "upi"],
    default: "cod",
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "verified", "na"],
    default: "na",
  },
  rejectedBy: { type: [String], default: [] },
  phone: String,
  /** Customer tells rider at door; never broadcast on sockets (see stripDeliveryPin). */
  deliveryPin: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, status: 1 });

module.exports = mongoose.model("Order", OrderSchema);
