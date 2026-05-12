import type { AppEnvironment } from "./environment.shared";

export const environment: AppEnvironment = {
  production: true,
  apiUrl: "https://food-delivery-app-dev.onrender.com/api",
  socketUrl: "https://food-delivery-app-dev.onrender.com",
  googleMapsApiKey: "AIzaSyCeE-s4yTloqvacHp6cBjnsbQL48vKtP4U",
  firebase: {
    apiKey: "AIzaSyDt3cIVT45vFEfaqnhnrYcaRwFpyPHvyf4",
    authDomain: "food-delivery-app-27518.firebaseapp.com",
    projectId: "food-delivery-app-27518",
    storageBucket: "food-delivery-app-27518.firebasestorage.app",
    messagingSenderId: "795842023608",
    appId: "1:795842023608:web:ea41d9d62f7742cd75a44d",
  },
};
