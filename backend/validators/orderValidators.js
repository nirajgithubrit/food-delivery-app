const { body, param } = require("express-validator");

const placeOrderRules = [
  body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array"),
  body("totalAmount").isNumeric().withMessage("totalAmount must be a number"),
  body("phone")
    .isString()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("phone must be at least 10 characters"),
  body("paymentMethod")
    .optional()
    .isIn(["cod", "upi"])
    .withMessage("paymentMethod must be cod or upi"),
  body().custom((_, { req }) => {
    const da = req.body?.deliveryAddress;
    if (da && typeof da === "object") {
      const lat = Number(da.latitude);
      const lng = Number(da.longitude);
      const full = String(da.fullAddress ?? "").trim();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("deliveryAddress must include valid latitude and longitude");
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error("deliveryAddress coordinates are out of range");
      }
      if (full.length < 5) {
        throw new Error("deliveryAddress.fullAddress must be at least 5 characters");
      }
      if (da.addressType != null && da.addressType !== "") {
        const t = String(da.addressType).toLowerCase();
        if (!["home", "office", "other"].includes(t)) {
          throw new Error("deliveryAddress.addressType must be home, office, or other");
        }
      }
      return true;
    }
    const loc = req.body?.location;
    if (loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
      return true;
    }
    throw new Error("Provide deliveryAddress (search or map) or legacy location coordinates");
  }),
];

const orderIdParam = [param("id").isMongoId().withMessage("Invalid order id")];

const assignRules = [
  param("id").isMongoId().withMessage("Invalid order id"),
  body("deliveryBoyId").isString().notEmpty().withMessage("deliveryBoyId required"),
];

const updateStatusRules = [
  param("id").isMongoId().withMessage("Invalid order id"),
  body("status")
    .isIn([
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "rejected",
    ])
    .withMessage("Valid status is required"),
];

const riderLocationRules = [
  body("lat").isFloat().withMessage("lat required"),
  body("lng").isFloat().withMessage("lng required"),
];

module.exports = {
  placeOrderRules,
  orderIdParam,
  assignRules,
  updateStatusRules,
  riderLocationRules,
};
