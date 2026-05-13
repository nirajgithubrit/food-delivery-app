import type { FirebaseOptions } from "firebase/app";

export interface FirebaseAppCheckConfig {
  readonly recaptchaEnterpriseSiteKey: string;
  readonly debugToken?: boolean | string;
}

/** Web app config + optional FCM Web Push public key (Firebase Console → Cloud Messaging). */
export type AppFirebaseConfig = FirebaseOptions & {
  readonly vapidKey?: string;
};

export interface AppEnvironment {
  readonly production: boolean;
  readonly apiUrl: string;
  readonly socketUrl: string;
  readonly googleMapsApiKey: string;
  /** Public origin of the deployed PWA (no trailing slash) — used for deep links in SW / docs. */
  readonly webPushSiteUrl?: string;
  /** Extra FCM / permission logs in the browser console. */
  readonly fcmDebug?: boolean;
  /**
   * When true (default if omitted in prod logic), FCM auto-init on iOS runs only in standalone (installed PWA).
   * Set `false` in local `environment.ts` to test in iOS Safari tabs.
   */
  readonly iosPushRequiresStandalone?: boolean;
  /**
   * When true, FCM may register in a normal browser tab (e.g. http://127.0.0.1:4200) for local testing.
   * Omit or false in production so only installed PWAs register (recommended).
   */
  readonly pushNotificationsAllowInBrowserTab?: boolean;
  readonly firebase: AppFirebaseConfig;
  readonly firebaseAppCheck?: FirebaseAppCheckConfig;
}
