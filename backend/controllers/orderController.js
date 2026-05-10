const Order = require("../models/order");
const User = require("../models/user");
const ApiResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { assertStatusTransition } = require("../utils/orderTransitions");
const config = require("../config");

exports.placeOrder = asyncHandler(async (req, res) => {
  const {
    items,
    totalAmount,
    location,
    phone,
    paymentMethod = "cod",
  } = req.body;

  const paymentStatus = paymentMethod === "upi" ? "pending" : "na";

  const safeItems = (Array.isArray(items) ? items : []).map((item) => ({
    _id: item?._id,
    name: item?.name,
    description: String(item?.description || "").trim(),
    category: String(item?.category || "").trim().toLowerCase(),
    price: Number(item?.price) || 0,
    qty: Number(item?.qty) || 0,
    image: item?.image || "",
  }));

  const order = await Order.create({
    userId: String(req.user.id),
    items: safeItems,
    totalAmount,
    location,
    phone,
    paymentMethod,
    paymentStatus,
    status: "pending",
    pickupStatus: "pending",
    deliveryBoyId: null,
    rejectedBy: [],
    restaurantLocation: {
      lat: config.restaurant.lat,
      lng: config.restaurant.lng,
    },
    restaurantName: config.restaurant.name,
    restaurantPhone: config.restaurant.phone,
  });

  const io = req.app.get("io");
  io.emit("new-order-admin", order);
  io.emit("new-order", order);

  ApiResponse.success(res, order, 201);
});

exports.getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).lean();
  ApiResponse.success(res, orders);
});

exports.getCustomerOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: String(req.user.id) })
    .sort({ createdAt: -1 })
    .lean();

  // Collect distinct rider ids that are valid ObjectIds, then attach rider info.
  const riderIds = [
    ...new Set(
      orders
        .map((o) => o.deliveryBoyId)
        .filter((id) => id && /^[0-9a-fA-F]{24}$/.test(String(id))),
    ),
  ];

  let ridersById = {};
  if (riderIds.length > 0) {
    const riders = await User.find(
      { _id: { $in: riderIds } },
      { name: 1, phone: 1 },
    ).lean();
    ridersById = riders.reduce((acc, r) => {
      acc[String(r._id)] = { name: r.name || "", phone: r.phone || "" };
      return acc;
    }, {});
  }

  const enriched = orders.map((o) => ({
    ...o,
    deliveryBoy: o.deliveryBoyId ? ridersById[String(o.deliveryBoyId)] || null : null,
    restaurantName: o.restaurantName || config.restaurant.name,
    restaurantPhone: o.restaurantPhone || config.restaurant.phone,
  }));

  ApiResponse.success(res, enriched);
});

exports.getDeliveryOrders = asyncHandler(async (req, res) => {
  const riderId = String(req.user.id);

  const orders = await Order.find({
    $or: [
      {
        deliveryBoyId: riderId,
        status: { $nin: ["completed", "rejected"] },
      },
      {
        deliveryBoyId: null,
        status: { $in: ["pending", "confirmed"] },
        rejectedBy: { $nin: [riderId] },
      },
    ],
  }).sort({ createdAt: -1 });

  req.log?.debug?.({
    msg: "delivery orders fetched",
    riderId,
    count: orders.length,
    orderIds: orders.map((o) => String(o._id)),
  });

  ApiResponse.success(res, orders);
});

exports.updateRiderLocation = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { location: req.body },
    { new: true },
  );
  if (!user) throw new AppError("User not found", 404);
  ApiResponse.success(res, user);
});

exports.updateOrder = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  assertStatusTransition(order.status, status);

  if (status === "inprogress" && !order.deliveryBoyId) {
    throw new AppError("Assign rider before starting delivery", 400);
  }

  if (status === "completed") {
    if (order.paymentMethod === "upi" && order.paymentStatus !== "verified") {
      throw new AppError("UPI payment must be verified before completion", 400);
    }
  }

  order.status = status;

  await order.save();

  if (order.status === "completed" && order.deliveryBoyId) {
    await User.findByIdAndUpdate(order.deliveryBoyId, { isAvailable: true });
  }

  const io = req.app.get("io");
  const idStr = order._id.toString();
  io.to(idStr).emit("order-updated", order);
  io.emit("order-updated", order);
  // Re-announce confirmed unassigned orders to rider pools for reliability
  if (status === "confirmed" && !order.deliveryBoyId) {
    io.emit("new-order", order);
  }
  // Keep delivery/customer UIs in sync when pool orders disappear (same as assign flow)
  if (status === "rejected") {
    io.emit("order-removed", idStr);
  }

  ApiResponse.success(res, order);
});

exports.markPickup = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  if (String(order.deliveryBoyId) !== String(req.user.id)) {
    throw new AppError("Not assigned to this order", 403);
  }
  if (!["confirmed", "inprogress"].includes(order.status)) {
    throw new AppError("Invalid order state for pickup", 400);
  }

  order.pickupStatus = "picked";
  await order.save();

  const io = req.app.get("io");
  io.to(order._id.toString()).emit("order-updated", order);
  io.emit("order-updated", order);
  ApiResponse.success(res, order);
});

exports.assignDelivery = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const deliveryBoyIdRaw = req.body?.deliveryBoyId;
  const riderId =
    deliveryBoyIdRaw == null ? "" : String(deliveryBoyIdRaw).trim();

  console.log("[assignDelivery] req.user=", req.user);
  console.log("[assignDelivery] req.params.id=", id);
  console.log("[assignDelivery] deliveryBoyId(body)=", deliveryBoyIdRaw);

  if (!riderId) {
    throw new AppError("deliveryBoyId is required", 400);
  }

  if (req.user.role === "delivery" && (req.user.id == null || String(req.user.id) === "")) {
    throw new AppError("Invalid auth payload", 401);
  }

  if (req.user.role === "delivery" && String(req.user.id) !== riderId) {
    throw new AppError("Cannot assign order to another rider", 403);
  }

  const before = await Order.findById(id).lean();
  console.log("[assignDelivery] order before update=", before);

  try {
    // Atomic assign without aggregation pipeline. Mongoose + runValidators on
    // pipeline updates often throws (surfacing as opaque 500s in production).
    // Business rules: unassigned + pending|confirmed only; accepting always
    // ensures restaurant-side "confirmed" (idempotent if already confirmed).
    const updated = await Order.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["pending", "confirmed"] },
        $or: [
          { deliveryBoyId: null },
          { deliveryBoyId: { $exists: false } },
          { deliveryBoyId: "" },
        ],
      },
      {
        $set: {
          deliveryBoyId: riderId,
          status: "confirmed",
        },
      },
      { new: true },
    );

    if (!updated) {
      const existing = await Order.findById(id);
      if (!existing) throw new AppError("Order not found", 404);
      throw new AppError("Order already assigned or invalid state", 409);
    }

    await User.findByIdAndUpdate(riderId, { isAvailable: false });

    const io = req.app.get("io");
    io.emit("order-removed", updated._id.toString());
    io.emit("order-updated", updated);

    ApiResponse.success(res, updated);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error("[assignDelivery] error:", err?.message || err, err?.stack);
    if (err.name === "ValidationError" || err.name === "CastError") {
      throw new AppError(err.message, 400);
    }
    throw err;
  }
});

exports.rejectOrder = asyncHandler(async (req, res) => {
  const riderId = String(req.user.id);
  await Order.findByIdAndUpdate(req.params.id, {
    $addToSet: { rejectedBy: riderId },
  });

  const io = req.app.get("io");
  io.to(riderId).emit("order-removed", req.params.id);

  ApiResponse.success(res, { message: "Rejected" });
});

exports.verifyPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  if (req.user.role === "delivery") {
    if (String(order.deliveryBoyId) !== String(req.user.id)) {
      throw new AppError("Not assigned to this order", 403);
    }
  }

  if (order.paymentMethod !== "upi") {
    throw new AppError("Payment verification only applies to UPI orders", 400);
  }

  order.paymentStatus = "verified";
  await order.save();

  const io = req.app.get("io");
  io.to(order._id.toString()).emit("order-updated", order);
  io.emit("order-updated", order);
  ApiResponse.success(res, order);
});
