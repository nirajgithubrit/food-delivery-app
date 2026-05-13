import type { AppEnvironment } from "./environment.shared";

/**
 * Production hosting — replace URLs with your main Render + Netlify origins
 * (no trailing slashes on socket/webPush).
 */
export const environment: AppEnvironment = {
  production: true,
  apiUrl: "https://gir-gamthi-online-order.onrender.com/api",
  socketUrl: "https://gir-gamthi-online-order.onrender.com",
  googleMapsApiKey: "AIzaSyCeE-s4yTloqvacHp6cBjnsbQL48vKtP4U",
  webPushSiteUrl: "https://girgamthionlineorder.netlify.app",
  fcmDebug: false,
  iosPushRequiresStandalone: true,
  firebase: {
    apiKey: "AIzaSyDt3cIVT45vFEfaqnhnrYcaRwFpyPHvyf4",
    authDomain: "food-delivery-app-27518.firebaseapp.com",
    projectId: "food-delivery-app-27518",
    storageBucket: "food-delivery-app-27518.firebasestorage.app",
    messagingSenderId: "795842023608",
    appId: "1:795842023608:web:ea41d9d62f7742cd75a44d",
    vapidKey:
      "BKbK9j4gQpis64KPFDT-I_7ciUdxjYhM79yKFdstny-8OJSWfTN16jR5gIF6W8hdIRZjsfFSuFckvEMQ0R_OOfM",
  },
};
