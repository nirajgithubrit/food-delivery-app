const mongoose = require('../db');

const UserSchema = new mongoose.Schema({
  phone: String,
  role: { type: String, default: 'customer' },

  // 🛵 DELIVERY INFO
  isAvailable: { type: Boolean, default: true },

  location: {
    lat: Number,
    lng: Number
  }
});

module.exports = mongoose.model('User', UserSchema);