const mongoose = require("../db");

const OrderSchema = new mongoose.Schema({
  userId: String,
  items: Array,
  totalAmount: Number,
  status: {
    type: String,
    default: "pending",
  },
  location: {
    lat: Number,
    lng: Number,
  },
  deliveryBoyId: String,
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
  phone: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
