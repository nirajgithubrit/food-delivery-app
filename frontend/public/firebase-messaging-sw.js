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

/** Build absolute navigation target for notification taps (Android PWA + iOS). */
function resolveClickTarget(data) {
  const origin = self.location.origin.replace(/\/+$/, "");
  let u = (data && data.click_url) || "";
  u = String(u).trim();
  if (!u && data && data.click_path) {
    const p = String(data.click_path).startsWith("/")
      ? String(data.click_path)
      : "/" + String(data.click_path);
    u = origin + p;
  }
  if (!u) return origin + "/";
  if (!/^https?:\/\//i.test(u)) {
    if (u.startsWith("/")) return origin + u;
    try {
      return new URL(u, origin + "/").href;
    } catch {
      return origin + "/";
    }
  }
  return u;
}

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
    payload.notification?.icon || "/icons/icon-192x192.jpg";
  const badge = "/icons/icon-72x72.jpg";
  const tag =
    (payload.data && (payload.data.orderId || payload.data.type)) ||
    "fcm-default";
  const flat = { ...(payload.data || {}) };
  const clickUrl = resolveClickTarget(flat);

  const options = {
    body,
    icon,
    badge,
    tag: String(tag),
    // renotify:true can surface duplicate banners on iOS Web Push for the same logical event.
    renotify: false,
    data: { ...flat, click_url: clickUrl },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  const url = resolveClickTarget(data);

  event.notification.close();
  event.waitUntil(
    (async () => {
      const origin = self.location.origin;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const sameOrigin = clients.filter(
        (c) => typeof c.url === "string" && c.url.startsWith(origin),
      );

      for (const client of sameOrigin) {
        try {
          await client.focus();
        } catch (_) {
          /* continue */
        }
        if (typeof client.navigate === "function") {
          try {
            await client.navigate(url);
            return;
          } catch (err) {
            console.warn("[firebase-messaging-sw] navigate failed", err);
          }
        }
      }

      if (self.clients.openWindow) {
        const opened = await self.clients.openWindow(url);
        if (opened) {
          try {
            await opened.focus();
          } catch (_) {
            /* no-op */
          }
          return;
        }
        await self.clients.openWindow(origin + "/");
      }
    })(),
  );
});
