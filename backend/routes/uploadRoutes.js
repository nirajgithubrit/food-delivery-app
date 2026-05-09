const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../middleware/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new AppError("Only image files are allowed", 400));
  },
});

router.post(
  "/image",
  protect,
  authorize("admin"),
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new AppError("Cloudinary is not configured on server", 500);
    }

    if (!req.file) {
      throw new AppError("Image file is required", 400);
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "food-delivery/items",
          resource_type: "image",
        },
        (error, uploaded) => {
          if (error) reject(error);
          else resolve(uploaded);
        },
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    ApiResponse.success(
      res,
      {
        imageUrl: result.secure_url,
        publicId: result.public_id,
      },
      201,
    );
  }),
);

module.exports = router;
