import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import {
  getMessaging,
  isSupported as isMessagingSupported,
  Messaging,
  getToken,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let firebaseApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.warn("Firebase web config is incomplete. Skipping initialization.");
    return null;
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export async function getFirebaseMessagingClient(): Promise<Messaging | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isMessagingSupported().catch(() => false);
  if (!supported) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  try {
    return getMessaging(app);
  } catch (error) {
    console.error("Failed to get Firebase Messaging client:", error);
    return null;
  }
}

export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const messaging = await getFirebaseMessagingClient();
  if (!messaging) {
    return null;
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. Cannot request FCM token.");
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(
        "/firebase-messaging-sw.js"
      ),
    });
    return token || null;
  } catch (error) {
    console.error("Error while requesting FCM token:", error);
    return null;
  }
}


