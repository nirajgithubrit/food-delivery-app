const admin = require("firebase-admin");
const AppError = require("./AppError");

let app;

function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

function parseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim()) {
    try {
      return JSON.parse(rawJson);
    } catch {
      throw new AppError("Invalid FIREBASE_SERVICE_ACCOUNT_JSON", 500);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new AppError(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
      500,
    );
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new AppError(
      "FIREBASE_PRIVATE_KEY is malformed. Include the full PEM key with BEGIN/END lines.",
      500,
    );
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function getFirebaseAdminApp() {
  if (app) return app;

  const serviceAccount = parseServiceAccount();
  app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return app;
}

async function verifyFirebaseIdToken(idToken) {
  try {
    getFirebaseAdminApp();
    return await admin.auth().verifyIdToken(idToken, false);
  } catch (err) {
    const logLevel = String(process.env.LOG_LEVEL || "").toLowerCase();
    if (process.env.NODE_ENV !== "production" || logLevel === "debug") {
      // eslint-disable-next-line no-console
      console.error(
        "[Firebase Admin] verifyIdToken failed:",
        err?.code || err?.message || err,
      );
    }
    throw new AppError("Invalid Firebase token", 401);
  }
}

module.exports = {
  verifyFirebaseIdToken,
};
