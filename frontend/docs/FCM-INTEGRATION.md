# FCM + iPhone PWA integration

## Frontend (`environment.prod.ts`)

- `firebase.vapidKey` — Web Push **public** key from Firebase Console → Project settings → Cloud Messaging → Web Push certificates.
- `webPushSiteUrl` — Public origin of the deployed app (no trailing slash), e.g. `https://your-app.netlify.app`. Used with backend `PUBLIC_WEB_ORIGIN` for notification deep links.
- `fcmDebug` — Set `true` temporarily for verbose `[FCM]` logs in the browser console.
- `iosPushRequiresStandalone` — Omit or `true` in production so **iOS only auto-subscribes in an installed PWA** (Add to Home Screen). In local `environment.ts` it is `false` so you can test in a normal Safari tab.

## Google Cloud (Browser API key)

The key in `firebase.apiKey` must allow **Firebase Installations API**. If Installations returns **403**, `getToken()` fails on all platforms including iPhone.

- APIs & Services → Credentials → your Browser key → API restrictions → include **Firebase Installations API** (and any other APIs you use, e.g. Identity Toolkit for phone auth).

## Firebase → Apple (iPhone delivery)

For **Safari / iOS Web Push**, configure **APNs** on the same Firebase project (Project settings → Cloud Messaging → Apple / APNs authentication key). Without this, Chrome/Android may work while iPhone does not.

## Backend

- Set **`PUBLIC_WEB_ORIGIN`** to the same public URL as the PWA (e.g. `https://your-app.netlify.app`). Used to build `click_url` for taps. Falls back to the first `ALLOWED_ORIGINS` entry if unset.
- Firebase Admin: `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`.

## Smoke test (admin)

`POST /api/notifications/push-test` with an **admin** session cookie/Bearer token. Delivers a test notification to that admin’s registered FCM device(s).

## User flow (iPhone)

1. Open the site in Safari → **Share → Add to Home Screen**.
2. Launch the app from the home screen icon (standalone).
3. Sign in → use **Enable notifications** in the banner (or allow when prompted).
4. iOS: **Settings → Notifications** — ensure the app is allowed.

## Files of interest

- `frontend/src/app/shared/services/messaging.service.ts` — permission, token, retries, foreground handler.
- `frontend/public/firebase-messaging-sw.js` — background display + `notificationclick`.
- `backend/services/pushNotification.service.js` — adds `click_url` to payloads.
- `backend/utils/fcm.js` — Firebase Admin `sendEachForMulticast` (sound / link / icons).
