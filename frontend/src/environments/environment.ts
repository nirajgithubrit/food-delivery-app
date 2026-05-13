import type { AppEnvironment } from "./environment.shared";

export const environment: AppEnvironment = {
  production: false,
  apiUrl: "http://localhost:3000/api",
  socketUrl: "http://localhost:3000",
  googleMapsApiKey: "AIzaSyCeE-s4yTloqvacHp6cBjnsbQL48vKtP4U",
  firebase: {
    apiKey: "AIzaSyDt3cIVT45vFEfaqnhnrYcaRwFpyPHvyf4",
    authDomain: "food-delivery-app-27518.firebaseapp.com",
    projectId: "food-delivery-app-27518",
    storageBucket: "food-delivery-app-27518.firebasestorage.app",
    messagingSenderId: "795842023608",
    appId: "1:795842023608:web:ea41d9d62f7742cd75a44d",
    /** Web Push public key (Firebase Console → Cloud Messaging). */
    vapidKey:
      "BKbK9j4gQpis64KPFDT-I_7ciUdxjYhM79yKFdstny-8OJSWfTN16jR5gIF6W8hdIRZjsfFSuFckvEMQ0R_OOfM",
  },
  // When App Check enforces Authentication, uncomment and fill from Firebase Console → App Check:
  // firebaseAppCheck: {
  //   recaptchaEnterpriseSiteKey: "YOUR_ENTERPRISE_SITE_KEY",
  //   debugToken: true, // then replace with the registered debug token string for localhost
  // },
};
