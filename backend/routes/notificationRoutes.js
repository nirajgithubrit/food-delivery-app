const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { registerFcmToken, removeFcmToken } = require("../controllers/notificationController");

const router = express.Router();

router.post("/fcm-token", protect, registerFcmToken);
router.post("/fcm-token/unregister", protect, removeFcmToken);

module.exports = router;
