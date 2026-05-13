/* global importScripts firebase */
/* eslint-disable no-undef */
/**
 * FCM service worker — runs alongside Angular ngsw-worker; owns the push subscription.
 * Keep script versions aligned with frontend/package.json `firebase`.
 */
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDt3cIVT45vFEfaqnhnrYcaRwFpyPHvyf4",
  authDomain: "food-delivery-app-27518.firebaseapp.com",
  projectId: "food-delivery-app-27518",
  storageBucket: "food-delivery-app-27518.firebasestorage.app",
  messagingSenderId: "795842023608",
  appId: "1:795842023608:web:ea41d9d62f7742cd75a44d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] background message", payload);

  const title =
    payload.notification?.title ||
    (payload.data && payload.data.title) ||
    "Update";
  const body =
    payload.notification?.body ||
    (payload.data && payload.data.body) ||
    "";
  const icon =
    payload.notification?.icon || "/icons/icon-192x192.png";
  const badge = "/icons/icon-72x72.png";
  const tag =
    (payload.data && (payload.data.orderId || payload.data.type)) ||
    "fcm-default";
  const clickUrl = (payload.data && payload.data.click_url) || "/";

  const options = {
    body,
    icon,
    badge,
    tag: String(tag),
    renotify: true,
    data: { ...(payload.data || {}), click_url: String(clickUrl) },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  const raw = data.click_url || "/";
  let url = String(raw);
  try {
    if (!/^https?:\/\//i.test(url)) {
      url = new URL(url, self.location.origin).href;
    }
  } catch {
    url = self.location.origin + "/";
  }

  event.notification.close();
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (
          typeof client.url === "string" &&
          client.url.startsWith(self.location.origin) &&
          "focus" in client
        ) {
          await client.focus();
          if (typeof client.navigate === "function") {
            try {
              await client.navigate(url);
              return;
            } catch (_) {
              /* fall through to openWindow */
            }
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
