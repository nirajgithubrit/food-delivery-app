import type { FirebaseOptions } from "firebase/app";

export interface FirebaseAppCheckConfig {
  readonly recaptchaEnterpriseSiteKey: string;
  readonly debugToken?: boolean | string;
}

export interface AppEnvironment {
  readonly production: boolean;
  readonly apiUrl: string;
  readonly socketUrl: string;
  readonly googleMapsApiKey: string;
  readonly firebase: FirebaseOptions;
  readonly firebaseAppCheck?: FirebaseAppCheckConfig;
}
