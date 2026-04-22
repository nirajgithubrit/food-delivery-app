const Order = require("../models/order");
const User = require("../models/user");

// 📦 PLACE ORDER + ASSIGN DELIVERY
exports.placeOrder = async (req, res) => {
  const orderData = req.body;

  const riders = await User.find({
    role: "delivery",
    isAvailable: true,
  });

  if (!riders.length) {
    return res.status(400).send({ message: "No delivery boy available" });
  }

  // 📏 find nearest
  let nearest = null;
  let minDistance = Infinity;

  for (const rider of riders) {
    // 🔥 skip invalid location
    if (!rider.location || !rider.location.lat || !rider.location.lng) continue;

    const dx = rider.location.lat - orderData.location.lat;
    const dy = rider.location.lng - orderData.location.lng;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = rider;
    }
  }

  if (!nearest) {
    console.log("⚠️ No rider with location → fallback assign");

    // 🔥 fallback → assign any available rider
    nearest = riders[0];

    if (!nearest) {
      return res.status(400).send({ message: "No delivery boy available" });
    }
  }

  await nearest.save();

  // 📦 create order
  const order = new Order({
    ...orderData,
    deliveryBoyId: nearest._id,
    status: "pending",
    pickupStatus: "pending",
    restaurantLocation: {
      lat: 22.721585, // 22.720134,
      lng: 71.647064, //71.655662,
    },
  });

  order.deliveryLocation = nearest.location;

  await order.save();

  const io = req.app.get("io");

  // 🔥 ADMIN
  io.emit("new-order-admin", order);

  // 🔥 ONLY THIS RIDER
  io.to(nearest._id.toString()).emit("new-order", order);

  res.send(order);
};
