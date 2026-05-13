/* global importScripts firebase */
/* eslint-disable no-undef */
/**
 * Dedicated FCM worker (separate from Angular ngsw-worker). Push is delivered here
 * even when another SW controls the page. Keep firebase version in sync with frontend/package.json.
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

firebase.messaging();
