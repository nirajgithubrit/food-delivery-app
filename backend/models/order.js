const mongoose = require("../db");

const OrderSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  items: { type: Array, default: [] },
  totalAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "confirmed", "inprogress", "completed", "rejected"],
    default: "pending",
    index: true,
  },
  location: {
    lat: Number,
    lng: Number,
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
  createdAt: { type: Date, default: Date.now },
});

OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, status: 1 });

module.exports = mongoose.model("Order", OrderSchema);
