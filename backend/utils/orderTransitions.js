const AppError = require("./AppError");

const VALID_TRANSITIONS = {
  pending: ["accepted", "cancelled", "rejected"],
  accepted: ["preparing", "cancelled", "rejected"],
  preparing: ["ready_for_pickup", "cancelled", "rejected"],
  ready_for_pickup: ["picked_up", "out_for_delivery", "cancelled"],
  picked_up: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

function assertStatusTransition(current, next) {
  if (current === next) return;
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(`Invalid status transition: ${current} → ${next}`, 400);
  }
}

module.exports = { assertStatusTransition, VALID_TRANSITIONS };
