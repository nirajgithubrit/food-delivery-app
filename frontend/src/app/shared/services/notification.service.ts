import { isPlatformBrowser } from "@angular/common";
import { Injectable, PLATFORM_ID, inject } from "@angular/core";
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

@Injectable({ providedIn: "root" })
export class NotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  private messaging: Messaging | null = null;
  private foregroundListenerAttached = false;
  private lastRegisteredToken: string | null = null;
  private warnedMissingVapid = false;

  /**
   * Registers the FCM SW, requests permission when needed, obtains a token, and posts it to the API.
   * Safe to call multiple times (e.g. after login and on full page reload).
   */
  async initForLoggedInUser(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const vapidKey = environment.firebase.vapidKey?.trim();
    if (!vapidKey) {
      if (!this.warnedMissingVapid) {
        this.warnedMissingVapid = true;
        if (!environment.production) {
          console.warn(
            "[FCM] Add `vapidKey` to environment.firebase (Firebase Console → Project settings → Cloud Messaging → Web Push certificates).",
          );
        }
      }
      return;
    }

    if (!(await isSupported().catch(() => false))) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    if (Notification.permission === "denied") return;

    if (Notification.permission !== "granted") {
      const outcome = await Notification.requestPermission();
      if (outcome !== "granted") return;
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(FCM_SW_URL);
      await navigator.serviceWorker.ready;
    } catch (err) {
      console.warn("[FCM] Service worker registration failed", err);
      return;
    }

    const app = this.getOrInitFirebaseApp();
    this.messaging = getMessaging(app);
    this.attachForegroundListener(this.messaging);

    let token: string;
    try {
      token = await getToken(this.messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch (err) {
      console.warn("[FCM] getToken failed", err);
      return;
    }

    if (!token) return;

    const alreadySynced = token === this.readStoredToken();
    if (!alreadySynced) {
      try {
        await firstValueFrom(this.api.registerFcmToken(token));
        this.writeStoredToken(token);
      } catch (err) {
        console.warn("[FCM] Backend token registration failed", err);
        return;
      }
    }

    this.lastRegisteredToken = token;
  }

  /** Removes the current device token from MongoDB (call before logout while cookies still work). */
  async unregisterFromBackend(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.lastRegisteredToken ?? this.readStoredToken();
    if (!token) return;
    try {
      await firstValueFrom(this.api.unregisterFcmToken(token));
    } catch {
      /* still clear local cache */
    }
    this.lastRegisteredToken = null;
    this.clearStoredToken();
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

  private attachForegroundListener(messaging: Messaging): void {
    if (this.foregroundListenerAttached) return;
    this.foregroundListenerAttached = true;
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? "Update";
      const body = payload.notification?.body ?? "";
      const text = body ? `${title}: ${body}` : title;
      this.toast.success(text);
    });
  }
}
