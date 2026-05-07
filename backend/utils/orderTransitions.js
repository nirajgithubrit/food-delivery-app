const AppError = require("./AppError");

const VALID_TRANSITIONS = {
  pending: ["confirmed", "rejected"],
  confirmed: ["inprogress", "rejected"],
  inprogress: ["completed"],
  completed: [],
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
