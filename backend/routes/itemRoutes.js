const express = require("express");
const router = express.Router();
const Item = require("../models/item");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const { protect, authorize } = require("../middleware/authMiddleware");
const AppError = require("../utils/AppError");
const { broadcastMenuUpdated } = require("../utils/menuBroadcast");

function normalizeCategory(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

router.post(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const image = String(req.body?.image || "").trim();
    const category = normalizeCategory(req.body?.category);
    const price = Number(req.body?.price);
    const isAvailable =
      typeof req.body?.isAvailable === "boolean" ? req.body.isAvailable : true;

    if (
      !name ||
      !description ||
      description.length < 8 ||
      !image ||
      !category ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new AppError(
        "name, description, category, price and image are required with valid values",
        400,
      );
    }

    const item = new Item({
      name,
      description,
      image,
      category,
      price,
      isAvailable,
    });
    await item.save();
    broadcastMenuUpdated(req.app.get("io"), { scope: "items", action: "created" });
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

router.put(
  "/:id",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    const image = String(req.body?.image || "").trim();
    const category = normalizeCategory(req.body?.category);
    const price = Number(req.body?.price);
    const isAvailable =
      typeof req.body?.isAvailable === "boolean" ? req.body.isAvailable : true;

    if (
      !name ||
      !description ||
      description.length < 8 ||
      !image ||
      !category ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      throw new AppError(
        "name, description, category, price and image are required with valid values",
        400,
      );
    }

    const updated = await Item.findByIdAndUpdate(
      req.params.id,
      { name, description, image, category, price, isAvailable },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new AppError("Item not found", 404);
    }
    broadcastMenuUpdated(req.app.get("io"), { scope: "items", action: "updated" });
    ApiResponse.success(res, updated);
  }),
);

router.delete(
  "/:id",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const removed = await Item.findByIdAndDelete(req.params.id);
    if (!removed) {
      throw new AppError("Item not found", 404);
    }
    broadcastMenuUpdated(req.app.get("io"), { scope: "items", action: "deleted" });
    ApiResponse.success(res, { _id: removed._id });
  }),
);

module.exports = router;
