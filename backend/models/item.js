const mongoose = require('../db');

const ItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 280,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 1,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Item', ItemSchema);