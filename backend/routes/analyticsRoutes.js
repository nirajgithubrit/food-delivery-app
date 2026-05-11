const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getOverview } = require("../controllers/analyticsController");

const router = express.Router();

router.get("/overview", protect, authorize("admin"), getOverview);

module.exports = router;
