const User = require("../models/user");
const logger = require("./logger");
const { tryGetMessaging } = require("./firebaseAdmin");

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

let warnedMissingFirebase;

function stringifyData(data = {}) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    out[String(k)] = typeof v === "string" ? v : String(v);
  }
  return out;
}

async function pruneBadToken(token) {
  if (!token) return;
  try {
    await User.updateMany({ fcmTokens: token }, { $pull: { fcmTokens: token } });
  } catch (err) {
    logger.warn({ msg: "fcm prune token failed", err: err?.message || String(err) });
  }
}

function dedupeTokens(tokens) {
  const set = new Set();
  for (const t of tokens) {
    const s = String(t || "").trim();
    if (s) set.add(s);
  }
  return [...set];
}

async function sendToTokens(tokens, notification, data = {}) {
  const messaging = tryGetMessaging();
  if (!messaging) {
    if (!warnedMissingFirebase) {
      warnedMissingFirebase = true;
      logger.warn({
        msg: "FCM disabled: Firebase Admin credentials missing or invalid (set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_* env vars)",
      });
    }
    return;
  }

  const list = dedupeTokens(tokens);
  if (!list.length) return;

  const flatData = stringifyData(data);
  const chunkSize = 500;

  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: {
          title: String(notification?.title || "Update"),
          body: String(notification?.body || ""),
        },
        data: flatData,
        android: { priority: "high" },
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
          },
        },
      });

      response.responses.forEach((resp, idx) => {
        if (resp.success) return;
        const code = resp.error?.code;
        if (code && INVALID_TOKEN_CODES.has(code)) {
          void pruneBadToken(chunk[idx]);
        } else {
          logger.debug({
            msg: "fcm send error",
            code: code || "unknown",
            message: resp.error?.message,
          });
        }
      });
    } catch (err) {
      logger.warn({ msg: "fcm sendEachForMulticast failed", err: err?.message || String(err) });
    }
  }
}

async function collectTokensForUserIds(ids) {
  const unique = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || "").trim())
        .filter((id) => /^[a-f0-9A-F]{24}$/.test(id)),
    ),
  ];
  if (!unique.length) return [];

  const users = await User.find({ _id: { $in: unique } }, { fcmTokens: 1 }).lean();
  const out = [];
  for (const u of users) {
    for (const t of u.fcmTokens || []) {
      if (t) out.push(t);
    }
  }
  return out;
}

async function collectTokensForRole(role) {
  const users = await User.find({ role: String(role || "").trim() }, { fcmTokens: 1 }).lean();
  const out = [];
  for (const u of users) {
    for (const t of u.fcmTokens || []) {
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * @param {string} userId Mongo ObjectId string
 * @param {{ title: string, body: string }} notification
 * @param {Record<string, string|number|boolean|undefined|null>} [data]
 */
async function notifyUserById(userId, notification, data = {}) {
  const tokens = await collectTokensForUserIds([userId]);
  await sendToTokens(tokens, notification, data);
}

/**
 * @param {"admin"|"customer"|"delivery"} role
 * @param {{ title: string, body: string }} notification
 * @param {Record<string, string|number|boolean|undefined|null>} [data]
 */
async function notifyUsersByRole(role, notification, data = {}) {
  const tokens = await collectTokensForRole(role);
  await sendToTokens(tokens, notification, data);
}

module.exports = { notifyUsersByRole, notifyUserById, sendToTokens };
