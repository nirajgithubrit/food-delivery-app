const express = require('express');
const router = express.Router();
const Item = require('../models/item');

const { protect, authorize } = require('../middleware/authMiddleware');

// 🧑‍💼 ONLY ADMIN CAN ADD
router.post('/', protect, authorize('admin'), async (req, res) => {
  const item = new Item(req.body);
  await item.save();
  res.send(item);
});

// 👤 ALL CAN VIEW
router.get('/', async (req, res) => {
  const items = await Item.find();
  res.send(items);
});

module.exports = router;