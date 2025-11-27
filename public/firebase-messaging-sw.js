/* global importScripts, firebase */

// Firebase Messaging service worker for Ready Set push notifications (REA-124)

importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

let messaging = null;

/**
 * Track notification click for analytics.
 * Sends a fire-and-forget request to the click tracking endpoint.
 */
async function trackNotificationClick(data) {
  try {
    const payload = {};
    if (data?.fcmMessageId) {
      payload.fcmMessageId = data.fcmMessageId;
    }
    if (data?.orderId) {
      payload.orderId = data.orderId;
    }
    if (data?.notificationId) {
      payload.notificationId = data.notificationId;
    }

    // Only send if we have something to track
    if (Object.keys(payload).length === 0) {
      return;
    }

    await fetch("/api/notifications/push/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the UX
    console.warn("Failed to track notification click:", error);
  }
}

async function initFirebase() {
  if (messaging) {
    return messaging;
  }

  try {
    const response = await fetch("/api/notifications/push/firebase-config");
    if (!response.ok) {
      // Configuration endpoint not available or misconfigured; skip initialization.
      return null;
    }

    const config = await response.json();
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification?.title || "Ready Set Update";
      const notificationOptions = {
        body: payload.notification?.body || "",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/badge-72x72.png",
        tag: payload.data?.orderId || "ready-set-notification",
        renotify: true,
        data: {
          url: payload.data?.url || "/",
          orderId: payload.data?.orderId,
          orderNumber: payload.data?.orderNumber,
          fcmMessageId: payload.fcmMessageId,
          notificationId: payload.data?.notificationId,
        },
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    return messaging;
  } catch (error) {
    console.error("Failed to initialize Firebase in service worker:", error);
    return null;
  }
}

self.addEventListener("install", (event) => {
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting();
  event.waitUntil(initFirebase());
});

self.addEventListener("activate", (event) => {
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});

// Ensure Firebase is initialized before handling push events
self.addEventListener("push", (event) => {
  event.waitUntil(initFirebase());
});

// Handle notification clicks to open the tracking or dashboard page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || "/";

  // Track the click for analytics
  event.waitUntil(
    Promise.all([
      trackNotificationClick(data),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        // Try to focus an existing window first
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open a new window if no existing window found
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
        return undefined;
      }),
    ])
  );
});


