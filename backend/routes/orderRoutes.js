const express = require("express");
const router = express.Router();

const { protect, authorize } = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const {
  placeOrderRules,
  assignRules,
  updateStatusRules,
  riderLocationRules,
  orderIdParam,
} = require("../validators/orderValidators");
const orderController = require("../controllers/orderController");

router.post(
  "/",
  protect,
  authorize("customer"),
  placeOrderRules,
  validateRequest,
  orderController.placeOrder,
);

router.get("/", protect, authorize("admin"), orderController.getAllOrders);

router.get("/me", protect, authorize("customer"), orderController.getCustomerOrders);

router.get("/my", protect, authorize("delivery"), orderController.getDeliveryOrders);

router.put(
  "/rider/location",
  protect,
  authorize("delivery"),
  riderLocationRules,
  validateRequest,
  orderController.updateRiderLocation,
);

router.put(
  "/:id",
  protect,
  authorize("admin", "delivery"),
  updateStatusRules,
  validateRequest,
  orderController.updateOrder,
);

router.put(
  "/:id/pickup",
  protect,
  authorize("delivery"),
  orderIdParam,
  validateRequest,
  orderController.markPickup,
);

router.put(
  "/assign/:id",
  protect,
  authorize("admin", "delivery"),
  assignRules,
  validateRequest,
  orderController.assignDelivery,
);

router.put(
  "/reject/:id",
  protect,
  authorize("delivery"),
  orderIdParam,
  validateRequest,
  orderController.rejectOrder,
);

router.put(
  "/:id/payment/verify",
  protect,
  authorize("admin", "delivery"),
  orderIdParam,
  validateRequest,
  orderController.verifyPayment,
);

module.exports = router;
