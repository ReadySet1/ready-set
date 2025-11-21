/* global importScripts, firebase */

// Firebase Messaging service worker for Ready Set push notifications (REA-124)

importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

let messaging = null;

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
        data: {
          url: payload.data?.url || "/",
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
  event.waitUntil(initFirebase());
});

// Ensure Firebase is initialized before handling push events
self.addEventListener("push", (event) => {
  event.waitUntil(initFirebase());
});

// Handle notification clicks to open the tracking or dashboard page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
      return undefined;
    })
  );
});


