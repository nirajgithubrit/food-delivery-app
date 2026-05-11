const admin = require("firebase-admin");
const AppError = require("./AppError");

let app;

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
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new AppError(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
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
    return await admin.auth().verifyIdToken(idToken, true);
  } catch {
    throw new AppError("Invalid Firebase token", 401);
  }
}

module.exports = {
  verifyFirebaseIdToken,
};
