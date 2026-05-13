const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  registerFcmToken,
  removeFcmToken,
  sendTestPush,
} = require("../controllers/notificationController");

const router = express.Router();

router.post("/fcm-token", protect, registerFcmToken);
router.post("/fcm-token/unregister", protect, removeFcmToken);
router.post("/push-test", protect, authorize("admin"), sendTestPush);

module.exports = router;
