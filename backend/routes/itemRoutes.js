const express = require("express");
const router = express.Router();
const Item = require("../models/item");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const item = new Item(req.body);
    await item.save();
    ApiResponse.success(res, item, 201);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await Item.find().lean();
    ApiResponse.success(res, items);
  }),
);

module.exports = router;
