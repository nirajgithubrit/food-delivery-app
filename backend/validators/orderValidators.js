const { body, param } = require("express-validator");

const placeOrderRules = [
  body("items").isArray({ min: 1 }).withMessage("items must be a non-empty array"),
  body("totalAmount").isNumeric().withMessage("totalAmount must be a number"),
  body("location.lat").isFloat().withMessage("location.lat required"),
  body("location.lng").isFloat().withMessage("location.lng required"),
  body("phone")
    .isString()
    .trim()
    .isLength({ min: 10, max: 20 })
    .withMessage("phone must be at least 10 characters"),
  body("paymentMethod")
    .optional()
    .isIn(["cod", "upi"])
    .withMessage("paymentMethod must be cod or upi"),
];

const orderIdParam = [param("id").isMongoId().withMessage("Invalid order id")];

const assignRules = [
  param("id").isMongoId().withMessage("Invalid order id"),
  body("deliveryBoyId").isString().notEmpty().withMessage("deliveryBoyId required"),
];

const updateStatusRules = [
  param("id").isMongoId().withMessage("Invalid order id"),
  body("status")
    .isIn(["pending", "confirmed", "inprogress", "completed", "rejected"])
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
