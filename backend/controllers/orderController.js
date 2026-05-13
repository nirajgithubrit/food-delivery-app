const crypto = require("crypto");
const Order = require("../models/order");
const User = require("../models/user");
const ApiResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const asyncHandler = require("../middleware/asyncHandler");
const { assertStatusTransition } = require("../utils/orderTransitions");
const { getPrimaryRestaurantSnapshot } = require("../utils/restaurantResolve");
const { stripDeliveryPin } = require("../utils/orderPublic");
const { notifyUsersByRole, notifyUserById } = require("../services/pushNotification.service");

function makeDeliveryPin() {
  return String(crypto.randomInt(100000, 1_000_000));
}

function orderRoom(orderId) {
  return `order_${String(orderId)}`;
}

const ACTIVE_STATUS = new Set([
  "pending",
  "accepted",
  "preparing",
  "ready_for_pickup",
  "picked_up",
  "out_for_delivery",
]);

const HISTORY_STATUS = new Set(["delivered", "cancelled", "rejected"]);

function getCustomerFacingStatus(status) {
  return String(status || "pending").toLowerCase();
}

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

  const rest = await getPrimaryRestaurantSnapshot();

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
    deliveryPin: makeDeliveryPin(),
    restaurantLocation: {
      lat: rest.lat,
      lng: rest.lng,
    },
    restaurantName: rest.name,
    restaurantPhone: rest.phone,
  });

  const io = req.app.get("io");
  const safeNew = stripDeliveryPin(order);
  io.emit("new-order-admin", safeNew);
  io.emit("new-order", safeNew);

  const short = String(order._id).slice(-6);
  const amount = order.totalAmount;
  void notifyUsersByRole(
    "admin",
    { title: "New order", body: `Order ${short} · ₹${amount}` },
    { type: "new_order", orderId: String(order._id), click_path: "/admin/orders" },
  );
  void notifyUsersByRole(
    "delivery",
    { title: "New order", body: `Pool order ${short} · ₹${amount}` },
    { type: "new_order_pool", orderId: String(order._id), click_path: "/delivery/dashboard" },
  );

  ApiResponse.success(res, stripDeliveryPin(order), 201);
});

exports.getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).select("-deliveryPin").lean();
  ApiResponse.success(res, orders);
});

async function enrichCustomerOrders(orders) {
  const restFallback = await getPrimaryRestaurantSnapshot();

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

  return orders.map((o) => {
    const { deliveryPin, ...rest } = o;
    return {
      ...rest,
      status: getCustomerFacingStatus(o.status),
      deliveryBoy: o.deliveryBoyId ? ridersById[String(o.deliveryBoyId)] || null : null,
      restaurantName: o.restaurantName || restFallback.name,
      restaurantPhone: o.restaurantPhone || restFallback.phone,
      ...(o.deliveryBoyId && deliveryPin ? { deliveryPin } : {}),
    };
  });
}

exports.getCustomerOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: String(req.user.id) })
    .sort({ createdAt: -1 })
    .lean();

  const enriched = await enrichCustomerOrders(orders);
  ApiResponse.success(res, enriched);
});

exports.getCustomerActiveOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: String(req.user.id) })
    .sort({ createdAt: -1 })
    .lean();
  const active = orders.filter((o) =>
    ACTIVE_STATUS.has(getCustomerFacingStatus(o.status)),
  );
  ApiResponse.success(res, await enrichCustomerOrders(active));
});

exports.getCustomerOrderHistory = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: String(req.user.id) })
    .sort({ createdAt: -1 })
    .lean();
  const history = orders.filter((o) =>
    HISTORY_STATUS.has(getCustomerFacingStatus(o.status)),
  );
  ApiResponse.success(res, await enrichCustomerOrders(history));
});

exports.getCustomerOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    userId: String(req.user.id),
  }).lean();
  if (!order) throw new AppError("Order not found", 404);
  const [enriched] = await enrichCustomerOrders([order]);
  ApiResponse.success(res, enriched);
});

function hasDeliveryAssignee(order) {
  const raw = order?.deliveryBoyId;
  if (raw == null) return false;
  const val = String(raw).trim().toLowerCase();
  return val !== "" && val !== "null" && val !== "undefined";
}

exports.getDeliveryOrders = asyncHandler(async (req, res) => {
  const riderId = String(req.user.id);

  const orders = await Order.find({
    $or: [
      {
        deliveryBoyId: riderId,
        status: { $nin: ["delivered", "cancelled", "rejected"] },
      },
      {
        $or: [
          { deliveryBoyId: null },
          { deliveryBoyId: "" },
          { deliveryBoyId: { $exists: false } },
        ],
        /** Keep in rider pool until a rider accepts — not only pending/accepted. */
        status: { $in: ["pending", "accepted", "preparing", "ready_for_pickup"] },
        rejectedBy: { $nin: [riderId] },
      },
    ],
  })
    .sort({ createdAt: -1 })
    .select("-deliveryPin")
    .lean();

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
  const { status, deliveryPin } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);

  assertStatusTransition(order.status, status);

  if (["preparing", "ready_for_pickup"].includes(status)) {
    if (!hasDeliveryAssignee(order)) {
      throw new AppError(
        "A rider must accept this delivery (or be assigned) before the kitchen can move the order to this stage.",
        400,
      );
    }
  }

  if (status === "out_for_delivery" && !hasDeliveryAssignee(order)) {
    throw new AppError("Assign rider before starting delivery", 400);
  }

  if (status === "delivered") {
    if (order.paymentMethod === "upi" && order.paymentStatus !== "verified") {
      throw new AppError("UPI payment must be verified before completion", 400);
    }
    if (req.user?.role === "delivery") {
    if (order.deliveryPin) {
      const pin = String(deliveryPin ?? "").trim();
      if (!pin) {
        throw new AppError("Enter the customer delivery PIN", 400);
      }
      if (!/^\d{4,6}$/.test(pin)) {
        throw new AppError("Delivery PIN must be 4–6 digits", 400);
      }
      if (pin !== order.deliveryPin) {
        throw new AppError("Delivery PIN does not match", 400);
      }
    }
    }
  }

  order.status = status;
  if (status === "picked_up" || status === "out_for_delivery" || status === "delivered") {
    order.pickupStatus = "picked";
  }

  await order.save();

  if (order.status === "delivered" && order.deliveryBoyId) {
    await User.findByIdAndUpdate(order.deliveryBoyId, { isAvailable: true });
  }

  const io = req.app.get("io");
  const idStr = order._id.toString();
  const safeOrder = stripDeliveryPin(order);
  io.to(orderRoom(idStr)).emit("order-updated", safeOrder);
  io.emit("order-updated", safeOrder);
  // Re-announce accepted unassigned orders to rider pools for reliability
  if (status === "accepted" && !order.deliveryBoyId) {
    io.emit("new-order", safeOrder);
  }
  // Keep delivery/customer UIs in sync when pool orders disappear (same as assign flow)
  if (status === "rejected") {
    io.emit("order-removed", idStr);
  }

  const shortId = idStr.slice(-6);
  if (status === "accepted") {
    void notifyUserById(
      order.userId,
      { title: "Order accepted", body: `Order #${shortId} was accepted` },
      { type: "order_accepted", orderId: idStr, click_path: `/orders/${idStr}` },
    );
  } else if (["out_for_delivery", "picked_up"].includes(status)) {
    void notifyUserById(
      order.userId,
      { title: "Out for delivery", body: `Order #${shortId} is on the way` },
      { type: "order_out_for_delivery", orderId: idStr, click_path: `/orders/${idStr}` },
    );
  } else if (status === "delivered") {
    void notifyUserById(
      order.userId,
      { title: "Delivered", body: `Order #${shortId} delivered` },
      { type: "order_delivered", orderId: idStr, click_path: `/orders/${idStr}` },
    );
  } else if (status === "rejected") {
    void notifyUserById(
      order.userId,
      { title: "Order update", body: `Order #${shortId} was not accepted` },
      { type: "order_rejected", orderId: idStr, click_path: `/orders/${idStr}` },
    );
  }

  ApiResponse.success(res, stripDeliveryPin(order));
});

exports.markPickup = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError("Order not found", 404);
  if (String(order.deliveryBoyId) !== String(req.user.id)) {
    throw new AppError("Not assigned to this order", 403);
  }
  if (!["ready_for_pickup"].includes(order.status)) {
    throw new AppError("Invalid order state for pickup", 400);
  }

  assertStatusTransition(order.status, "out_for_delivery");

  order.pickupStatus = "picked";
  /** Same lifecycle as admin “Dispatch” — customer map and ETA switch to rider → customer immediately. */
  order.status = "out_for_delivery";
  await order.save();

  const io = req.app.get("io");
  const idStr = order._id.toString();
  const shortId = idStr.slice(-6);
  const safeOrder = stripDeliveryPin(order);
  io.to(orderRoom(idStr)).emit("order-updated", safeOrder);
  io.emit("order-updated", safeOrder);

  void notifyUserById(
    order.userId,
    { title: "Out for delivery", body: `Order #${shortId} is on the way` },
    { type: "order_out_for_delivery", orderId: idStr, click_path: `/orders/${idStr}` },
  );

  ApiResponse.success(res, safeOrder);
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
    // Business rules: unassigned + pending|accepted only.
    const updated = await Order.findOneAndUpdate(
      {
        _id: id,
        status: { $in: ["pending", "accepted"] },
        $or: [
          { deliveryBoyId: null },
          { deliveryBoyId: { $exists: false } },
          { deliveryBoyId: "" },
        ],
      },
      {
        $set: {
          deliveryBoyId: riderId,
          status: "accepted",
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
    const safeUpdated = stripDeliveryPin(updated);
    io.emit("order-updated", safeUpdated);

    const oid = String(updated._id);
    const tail = oid.slice(-6);
    void notifyUserById(
      updated.userId,
      { title: "Rider assigned", body: `A partner is on the way for #${tail}` },
      { type: "delivery_assigned", orderId: oid, click_path: `/orders/${oid}` },
    );
    void notifyUserById(
      riderId,
      { title: "New delivery", body: `You have order #${tail}` },
      { type: "delivery_assigned_rider", orderId: oid, click_path: "/delivery/dashboard" },
    );

    ApiResponse.success(res, safeUpdated);
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
  const safeOrder = stripDeliveryPin(order);
  io.to(orderRoom(order._id.toString())).emit("order-updated", safeOrder);
  io.emit("order-updated", safeOrder);
  ApiResponse.success(res, safeOrder);
});
