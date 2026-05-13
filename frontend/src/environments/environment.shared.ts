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
  readonly firebase: AppFirebaseConfig;
  readonly firebaseAppCheck?: FirebaseAppCheckConfig;
}
