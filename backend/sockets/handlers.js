const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const Order = require("../models/order");
const config = require("../config");
const logger = require("../utils/logger");

function verifyOrderRoomAccess(order, user) {
  if (!user) return config.socketAuthOptional;
  if (user.role === "admin") return true;
  if (user.role === "customer" && String(order.userId) === String(user.id)) return true;
  if (user.role === "delivery" && String(order.deliveryBoyId) === String(user.id)) {
    return true;
  }
  return false;
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.info({ msg: "Socket connected", id: socket.id, role: socket.user?.role });

    socket.on("join-order", async (orderId) => {
      try {
        if (!socket.user && !config.socketAuthOptional) return;

        const order = await Order.findById(orderId).lean();
        if (!order) return;

        if (socket.user && !verifyOrderRoomAccess(order, socket.user)) {
          logger.warn({ msg: "join-order denied", orderId, userId: socket.user.id });
          return;
        }

        socket.join(`order_${String(orderId)}`);
      } catch (e) {
        logger.error({ msg: "join-order error", err: e.message });
      }
    });

    socket.on("join-delivery", (id) => {
      if (!id) return;
      if (socket.user?.role === "delivery" && String(socket.user.id) !== String(id)) {
        logger.warn({ msg: "join-delivery id mismatch", id, userId: socket.user?.id });
        return;
      }
      socket.join(String(id));
    });

    socket.on("send-location", async (data) => {
      try {
        const { orderId, lat, lng } = data || {};
        if (!orderId || lat == null || lng == null) return;

        if (!socket.user || socket.user.role !== "delivery") {
          return;
        }

        const order = await Order.findById(orderId);
        if (!order) return;

        if (
          socket.user.role !== "delivery" ||
          String(order.deliveryBoyId) !== String(socket.user.id)
        ) {
          return;
        }

        const updated = await Order.findByIdAndUpdate(
          orderId,
          { deliveryLocation: { lat, lng } },
          { new: true },
        );

        io.to(`order_${String(orderId)}`).emit("location-update", updated);
      } catch (e) {
        logger.error({ msg: "send-location error", err: e.message });
      }
    });

    socket.on("disconnect", (reason) => {
      logger.info({ msg: "Socket disconnected", id: socket.id, reason });
    });
  });
}

module.exports = { registerSocketHandlers };
