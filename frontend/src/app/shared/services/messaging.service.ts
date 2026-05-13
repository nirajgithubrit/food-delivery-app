/**
 * Firebase Cloud Messaging (FCM) for Angular PWA — Android Chrome, desktop browsers, iPhone Safari PWA.
 *
 * Integration (summary):
 * 1) Firebase Console: Web app + Web Push certificate (VAPID public key in environment.firebase.vapidKey).
 * 2) Google Cloud: Browser API key must allow Firebase Installations API + correct HTTP referrer restrictions.
 * 3) Firebase Console → Cloud Messaging: configure Apple APNs auth key for Safari / iOS web push delivery.
 * 4) Deploy `firebase-messaging-sw.js` at site root (Angular `public/`). `environment.webPushSiteUrl` = production origin (used for notification click URLs).
 * 5) iOS 16.4+: install PWA from Safari (Add to Home Screen); push auto-init skips in Safari tab when `iosPushRequiresStandalone` is true (default in prod).
 * 6) Local dev: set `pushNotificationsAllowInBrowserTab: true` in `environment.ts` so FCM can register
 *    at http://127.0.0.1:4200 without installing the PWA. Grant notification permission; use “Enable
 *    notifications” if shown. Foreground pushes show as in-app toasts (`onMessage`). Background pushes
 *    require the tab to be in the background or use Firebase “Send test message” to the device token.
 */
import { isPlatformBrowser } from "@angular/common";
import {
  Injectable,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from "@angular/core";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import { ApiService } from "../../services/api.service";
import { ToastService } from "./toast.service";

const FCM_SW_URL = "/firebase-messaging-sw.js";
const FCM_TOKEN_STORAGE_KEY = "fcmDeviceToken";
const FCM_REGISTERED_LS_KEY = "gg_fcm_registered";
const GET_TOKEN_MAX_ATTEMPTS = 4;
const GET_TOKEN_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isAndroidDevice()) return false;
  const ua = navigator.userAgent;
  return (
    /iPhone|iPod/i.test(ua) ||
    /iPad/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

@Injectable({ providedIn: "root" })
export class MessagingService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  private messaging: Messaging | null = null;
  private foregroundListenerAttached = false;
  private lastRegisteredToken: string | null = null;
  private warnedMissingVapid = false;
  private lastVisibilityResyncMs = 0;

  /** Last known browser permission (updated on init / explicit request). */
  readonly permissionState = signal<NotificationPermission | "unsupported">(
    "unsupported",
  );

  /** True after a successful backend token registration for this session/tab. */
  readonly fcmReady = signal(false);

  private readonly fcmDebug = (): boolean =>
    environment.fcmDebug === true || !environment.production;

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.refreshPermissionSignal();
        const resync = () => {
          const now = Date.now();
          if (now - this.lastVisibilityResyncMs < 8_000) return;
          this.lastVisibilityResyncMs = now;
          void this.initForLoggedInUser();
        };
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState !== "visible") return;
          resync();
        });
        window.addEventListener("focus", () => resync());
      }
    });
  }

  private log(...args: unknown[]): void {
    if (this.fcmDebug()) {
      console.debug("[FCM]", ...args);
    }
  }

  /** True when the app runs as an installed PWA (not a normal browser tab). */
  readonly isInstalledPwa = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return false;
    return isStandaloneDisplayMode();
  });

  /** iOS Safari in a tab: show install hint instead of auto-subscribe (prod default). */
  readonly shouldShowIosInstallHint = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (!isIosLikeDevice()) return false;
    if (isStandaloneDisplayMode()) return false;
    return this.iosPushRequiresStandalone();
  });

  /** Show “Enable notifications” when logged-in flow can still subscribe. */
  readonly shouldShowEnablePushButton = computed(() => {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (!this.canUseWebPushInThisContext()) return false;
    const p = this.permissionState();
    if (p === "denied" || p === "unsupported") return false;
    if (p === "granted" && (this.fcmReady() || this.readFcmRegisteredPersisted())) {
      return false;
    }
    return p === "default" || !this.fcmReady();
  });

  private iosPushRequiresStandalone(): boolean {
    return environment.iosPushRequiresStandalone !== false;
  }

  private refreshPermissionSignal(): void {
    if (!isPlatformBrowser(this.platformId) || !("Notification" in window)) {
      this.permissionState.set("unsupported");
      return;
    }
    this.permissionState.set(Notification.permission);
  }

  /** Installed PWA, or explicit dev flag to allow a normal tab (localhost testing). */
  private canUseWebPushInThisContext(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    if (isStandaloneDisplayMode()) return true;
    return environment.pushNotificationsAllowInBrowserTab === true;
  }

  /**
   * Auto path after login / app load. Respects iOS “installed PWA only” when enabled.
   * Does not call `requestPermission()` unless already granted (avoids surprise prompts).
   */
  async initForLoggedInUser(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.refreshPermissionSignal();

    if (!this.canUseWebPushInThisContext()) {
      this.log(
        "init skip: use installed PWA, or set environment.pushNotificationsAllowInBrowserTab for localhost",
      );
      return;
    }

    if (Notification.permission === "denied") {
      this.log("init skip: Notification.permission is denied");
      return;
    }

    if (Notification.permission !== "granted") {
      this.log("init skip: awaiting explicit permission (use Enable notifications in the app)");
      return;
    }

    await this.registerServiceWorkerAndToken({ requestPermission: false });
  }

  /** User tapped “Enable notifications” — safe prompt + token + backend. */
  async requestEnablePush(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.refreshPermissionSignal();

    if (!this.canUseWebPushInThisContext()) {
      this.toast.info(
        "Install this site as an app (browser menu → Install app or Add to Home Screen), then open the app and enable notifications there — or enable pushNotificationsAllowInBrowserTab in environment for localhost.",
      );
      return;
    }

    await this.registerServiceWorkerAndToken({ requestPermission: true });
  }

  async unregisterFromBackend(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.lastRegisteredToken ?? this.readStoredToken();
    if (token) {
      try {
        await firstValueFrom(this.api.unregisterFcmToken(token));
        this.log("unregister: backend OK");
      } catch (e) {
        this.log("unregister: backend error (continuing local clear)", e);
      }
    }
    this.lastRegisteredToken = null;
    this.clearStoredToken();
    this.clearFcmRegisteredPersisted();
    this.fcmReady.set(false);
  }

  private async registerServiceWorkerAndToken(opts: {
    requestPermission: boolean;
  }): Promise<void> {
    const vapidKey = environment.firebase.vapidKey?.trim();
    if (!vapidKey) {
      if (!this.warnedMissingVapid) {
        this.warnedMissingVapid = true;
        console.warn(
          "[FCM] Missing environment.firebase.vapidKey (Firebase Console → Cloud Messaging → Web Push certificates).",
        );
      }
      return;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      this.log("isSupported() = false — browser cannot use FCM web");
      return;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      this.log("Notifications or serviceWorker API missing");
      return;
    }

    if (opts.requestPermission) {
      if (Notification.permission === "denied") {
        this.toast.error("Notifications are blocked. Enable them in browser or iOS Settings for this app.");
        this.refreshPermissionSignal();
        return;
      }
      if (Notification.permission === "default") {
        this.log("requestPermission: asking user");
        const outcome = await Notification.requestPermission();
        this.refreshPermissionSignal();
        this.log("requestPermission: result", outcome);
        if (outcome !== "granted") {
          this.toast.error("Notifications were not enabled.");
          return;
        }
      }
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(FCM_SW_URL, {
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;
      this.log("service worker registered", registration.scope);
    } catch (err) {
      console.warn("[FCM] Service worker registration failed", err);
      return;
    }

    const app = this.getOrInitFirebaseApp();
    this.messaging = getMessaging(app);
    this.attachForegroundListener(this.messaging);

    const token = await this.getTokenWithRetries(this.messaging, vapidKey, registration);
    if (!token) return;

    const alreadySynced = token === this.readStoredToken();
    if (!alreadySynced) {
      try {
        await firstValueFrom(this.api.registerFcmToken(token));
        this.writeStoredToken(token);
        this.log("token registered with backend");
      } catch (err) {
        console.warn("[FCM] Backend token registration failed", err);
        return;
      }
    }

    this.lastRegisteredToken = token;
    this.fcmReady.set(true);
    this.markFcmRegisteredPersisted();
    this.log("FCM ready, token tail", token.slice(-12));
  }

  private readFcmRegisteredPersisted(): boolean {
    try {
      return localStorage.getItem(FCM_REGISTERED_LS_KEY) === "1";
    } catch {
      return false;
    }
  }

  private markFcmRegisteredPersisted(): void {
    try {
      localStorage.setItem(FCM_REGISTERED_LS_KEY, "1");
    } catch {
      /* no-op */
    }
  }

  private clearFcmRegisteredPersisted(): void {
    try {
      localStorage.removeItem(FCM_REGISTERED_LS_KEY);
    } catch {
      /* no-op */
    }
  }

  private async getTokenWithRetries(
    messaging: Messaging,
    vapidKey: string,
    registration: ServiceWorkerRegistration,
  ): Promise<string | null> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= GET_TOKEN_MAX_ATTEMPTS; attempt++) {
      try {
        this.log(`getToken attempt ${attempt}/${GET_TOKEN_MAX_ATTEMPTS}`);
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        if (token) return token;
        this.log("getToken returned empty string");
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        this.log(`getToken attempt ${attempt} failed`, msg);
        if (
          msg.includes("installations") ||
          msg.includes("PERMISSION_DENIED") ||
          msg.includes("firebaseinstallations")
        ) {
          console.warn(
            "[FCM] Firebase Installations blocked. Google Cloud → Credentials → Browser API key → allow Firebase Installations API + correct HTTP referrer restrictions.",
            err,
          );
          return null;
        }
        if (attempt < GET_TOKEN_MAX_ATTEMPTS) {
          await sleep(GET_TOKEN_BASE_DELAY_MS * attempt);
        }
      }
    }
    console.warn("[FCM] getToken failed after retries", lastErr);
    return null;
  }

  private readStoredToken(): string | null {
    try {
      return sessionStorage.getItem(FCM_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeStoredToken(token: string): void {
    try {
      sessionStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } catch {
      /* no-op */
    }
  }

  private clearStoredToken(): void {
    try {
      sessionStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    } catch {
      /* no-op */
    }
  }

  private getOrInitFirebaseApp(): FirebaseApp {
    return getApps().length ? getApp() : initializeApp(environment.firebase);
  }

  private attachForegroundListener(msgInstance: Messaging): void {
    if (this.foregroundListenerAttached) return;
    this.foregroundListenerAttached = true;
    onMessage(msgInstance, (payload) => {
      this.log("foreground message", payload);
      const title = payload.notification?.title ?? "Update";
      const body = payload.notification?.body ?? "";
      const text = body ? `${title}: ${body}` : title;
      this.toast.success(text);
    });
  }
}
