const mongoose = require('../db');

const ItemSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  isAvailable: { type: Boolean, default: true }
});

module.exports = mongoose.model('Item', ItemSchema);