const logger = require("./logger");

/**
 * Push notifications were previously sent via Firebase Cloud Messaging.
 * Stubbed — implement a non-Firebase provider if you need mobile/web push again.
 */
async function notifyUserById(_userId, _notification, _data = {}) {
  logger.debug({ msg: "notifyUserById: push disabled (no FCM)" });
}

async function notifyUsersByRole(_role, _notification, _data = {}) {
  logger.debug({ msg: "notifyUsersByRole: push disabled (no FCM)" });
}

module.exports = { notifyUsersByRole, notifyUserById };
