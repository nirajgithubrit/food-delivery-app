const express = require("express");
const router = express.Router();
const Category = require("../models/category");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const { protect, authorize } = require("../middleware/authMiddleware");
const AppError = require("../utils/AppError");

function makeSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const categories = await Category.find().sort({ name: 1 }).lean();
    ApiResponse.success(res, categories);
  }),
);

router.post(
  "/",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw new AppError("Category name is required", 400);
    }
    const slug = makeSlug(name);
    if (!slug) {
      throw new AppError("Invalid category name", 400);
    }

    const exists = await Category.findOne({ $or: [{ name }, { slug }] }).lean();
    if (exists) {
      throw new AppError("Category already exists", 409);
    }

    const created = await Category.create({ name, slug });
    ApiResponse.success(res, created, 201);
  }),
);

router.put(
  "/:id",
  protect,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) {
      throw new AppError("Category name is required", 400);
    }
    const slug = makeSlug(name);
    if (!slug) {
      throw new AppError("Invalid category name", 400);
    }

    const duplicate = await Category.findOne({
      _id: { $ne: req.params.id },
      $or: [{ name }, { slug }],
    }).lean();
    if (duplicate) {
      throw new AppError("Category already exists", 409);
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new AppError("Category not found", 404);
    }
    ApiResponse.success(res, updated);
  }),
);

module.exports = router;
