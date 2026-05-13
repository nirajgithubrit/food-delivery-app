/**
 * Strip handoff PIN from payloads broadcast over sockets or returned to admin/rider.
 */
function stripDeliveryPin(order) {
  if (!order) return order;
  const plain =
    typeof order.toObject === "function"
      ? order.toObject({ virtuals: false })
      : { ...order };
  delete plain.deliveryPin;
  return plain;
}

module.exports = { stripDeliveryPin };
