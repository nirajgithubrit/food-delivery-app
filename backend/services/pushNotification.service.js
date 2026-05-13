const config = require("../config");
const fcm = require("../utils/fcm");

/**
 * Adds absolute `click_url` for Web/iOS notification taps when missing.
 */
function withClickThrough(data = {}) {
  const base = String(config.publicWebOrigin || "").replace(/\/+$/, "");
  const out = { ...data };
  if (base && out.click_url == null) {
    if (out.click_path) {
      const p = String(out.click_path).startsWith("/")
        ? String(out.click_path)
        : `/${String(out.click_path)}`;
      out.click_url = `${base}${p}`;
    } else if (out.orderId) {
      out.click_url = `${base}/orders/${String(out.orderId)}`;
    } else {
      out.click_url = `${base}/`;
    }
  }
  return out;
}

async function notifyUserById(userId, notification, data = {}) {
  return fcm.notifyUserById(userId, notification, withClickThrough(data));
}

async function notifyUsersByRole(role, notification, data = {}) {
  return fcm.notifyUsersByRole(role, notification, withClickThrough(data));
}

async function sendToTokens(tokens, notification, data = {}) {
  return fcm.sendToTokens(tokens, notification, withClickThrough(data));
}

module.exports = {
  notifyUserById,
  notifyUsersByRole,
  sendToTokens,
  withClickThrough,
};
