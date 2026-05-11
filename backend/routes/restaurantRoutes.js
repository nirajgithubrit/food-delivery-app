const express = require("express");
const multer = require("multer");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getMyRestaurant,
  updateMyRestaurant,
  updateRestaurantImages,
  changeAdminPassword,
} = require("../controllers/restaurantController");
const AppError = require("../utils/AppError");

const router = express.Router();

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

router.get("/me", protect, authorize("admin"), getMyRestaurant);
router.put("/me", protect, authorize("admin"), updateMyRestaurant);
router.put(
  "/me/images",
  protect,
  authorize("admin"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  updateRestaurantImages,
);
router.put("/me/password", protect, authorize("admin"), changeAdminPassword);

module.exports = router;
