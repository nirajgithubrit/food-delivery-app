const express = require("express");
const router = express.Router();

const Order = require("../models/order");
const User = require("../models/user");

const { protect, authorize } = require("../middleware/authMiddleware");
const { placeOrder } = require("../controllers/orderController");

// 👤 CUSTOMER PLACE ORDER (AUTO ASSIGN DELIVERY)
router.post("/", protect, placeOrder);

// 🧑‍💼 ADMIN VIEW ALL ORDERS
router.get("/", protect, async (req, res) => {
  const orders = await Order.find();
  res.send(orders);
});

// Rider Update Location
router.put("/rider/location", protect, async (req, res) => {
  const userId = req.user.id;
  console.log(userId);

  const user = await User.findByIdAndUpdate(
    userId,
    { location: req.body },
    { returnDocument: "after" },
  );

  res.send(user);
});

// 🧑‍💼 ADMIN UPDATE ORDER STATUS
router.put(
  "/:id",
  protect,
  authorize("admin", "delivery"),
  async (req, res) => {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { returnDocument: "after" },
    );

    // 🔥 FREE DELIVERY BOY WHEN ORDER COMPLETED
    if (req.body.status === "completed" && order.deliveryBoyId) {
      await User.findByIdAndUpdate(order.deliveryBoyId, {
        isAvailable: true,
      });

      console.log("🚴 Delivery boy released");
    }

    // 🔥 REALTIME UPDATE
    const io = req.app.get("io");

    io.to(order._id.toString()).emit("order-updated", order); // Admin
    io.emit("order-updated", order); // customer

    res.send(order);
  },
);

router.put("/:id/pickup", async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { pickupStatus: "picked" },
    { returnDocument: "after" },
  );

  req.app.get("io").to(order._id.toString()).emit("order-updated", order);

  res.send(order);
});

// 🚴 ASSIGN DELIVERY BOY
router.put("/assign/:id", protect, async (req, res) => {
  const { deliveryBoyId } = req.body;

  await User.findByIdAndUpdate(deliveryBoyId, {
        isAvailable: false,
      });

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      deliveryBoyId,
      status: "confirmed", // 🔥 after accept → confirmed
    },
    { returnDocument: "after" },
  );

  // 🔥 SOCKET EMIT
  req.app.get("io").emit("order-updated", order);

  res.send(order);
});

module.exports = router;
