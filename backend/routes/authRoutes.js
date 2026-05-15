const express = require("express");
const multer = require("multer");
const router = express.Router();

const {
  adminLogin,
  registerAdmin,
  deliveryLogin,
  firebaseLogin,
  logout,
  getMe,
  getSavedDeliveryAddresses,
  refreshTokens,
} = require("../controllers/authController");
const { authLoginLimiter, adminRegisterLimiter } = require("../middleware/rateLimiters");
const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const { body } = require("express-validator");

const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== "logo" && file.fieldname !== "banner") {
      cb(null, false);
      return;
    }
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files for logo/banner"));
  },
});

router.post("/refresh", authLoginLimiter, refreshTokens);
router.post(
  "/firebase-login",
  authLoginLimiter,
  body("firebaseToken").isString().trim().notEmpty().withMessage("Firebase token is required"),
  body("mobile").optional().isString().withMessage("Mobile must be a string"),
  validateRequest,
  firebaseLogin,
);

router.post("/admin", authLoginLimiter, adminLogin);
router.post(
  "/admin/register",
  adminRegisterLimiter,
  registerUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  registerAdmin,
);
router.post("/delivery", authLoginLimiter, deliveryLogin);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.get(
  "/me/saved-delivery-addresses",
  protect,
  authorize("customer"),
  getSavedDeliveryAddresses,
);

module.exports = router;
