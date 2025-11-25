import { App, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

/**
 * Firebase Admin singleton wrapper
 *
 * This module centralizes initialization of the Firebase Admin SDK so it can be
 * safely imported from server-side code (API routes, server actions, services)
 * without causing duplicate-app errors during hot reloads.
 *
 * Environment variables:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY  (use `\\n`-escaped newlines; we normalize them here)
 */

let app: App | null = null;
let messaging: Messaging | null = null;

function getFirebaseApp(): App | null {
  if (app) {
    return app;
  }

  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    // Incomplete configuration – do not throw in production paths that should degrade gracefully.
    console.warn(
      "Firebase Admin not fully configured. Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY."
    );
    return null;
  }

  const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n");

  try {
    app = initializeApp({
      credential: {
        getAccessToken: async () => {
          // Use application default credentials if available; otherwise fallback to service account.
          // For now, we only support service account JSON via env variables.
          return {
            access_token: "",
            expires_in: 0,
          };
        },
        projectId,
        clientEmail,
        privateKey: normalizedPrivateKey,
      } as any,
      projectId,
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin app:", error);
    app = null;
  }

  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  if (messaging) {
    return messaging;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  try {
    messaging = getMessaging(firebaseApp);
  } catch (error) {
    console.error("Failed to initialize Firebase Messaging:", error);
    messaging = null;
  }

  return messaging;
}


