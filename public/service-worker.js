// ReadySet Driver Portal Service Worker
//
// The offline GPS queue lives in the PAGE now (src/lib/tracking/location-outbox.ts),
// not here. This worker used to answer a failed location POST with a synthetic
// 202 and keep the fix in its own store, replaying it only on a Background Sync
// `sync` event — which Android WebView (the native wrapper) and iOS Safari never
// fire. Every fix of a multi-minute outage was lost that way (2026-10-17), and
// the page took the 202 as "saved" so it never queued them itself.
// What is left: cache cleanup, and draining fixes an older version queued
// (Chrome on Android only, where `sync` exists).

// Bumped from v1: activate deletes every other cache, which clears the stale
// /driver/tracking HTML and authenticated API responses v1 stored on phones.
// Nothing is cached any more; the name only exists so activate can clean up.
const CACHE_NAME = 'readyset-driver-v2';

const LOCATION_QUEUE_STORE = 'location-queue';
const DB_NAME = 'readyset-driver-db';
const DB_VERSION = 1;

// Flush pacing for the legacy queue: trickle queued posts instead of bursting
// them into the server rate limiter, and back off entirely on a 429.
const LOCATION_FLUSH_SPACING_MS = 250;
// Older fixes can't be filed by the server (it would stamp them NOW() and show
// them as the driver's current position), so they are discarded unsent.
const LOCATION_REPLAY_MAX_AGE_MS = 23 * 60 * 60 * 1000;
const LOCATION_FLUSH_429_BACKOFF_MS = 30000;
let locationFlushBackoffUntil = 0;

// Install event - nothing to precache; take over as soon as possible.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// No fetch handler: every request, location POSTs included, goes straight to
// the network, so a failed location POST rejects in the page and lands in the
// page's own outbox. (Without a fetch listener the browser also skips the
// worker on every request — no respondWith pitfalls on Safari.)

// Background sync event - retry failed requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    console.log('Background sync triggered for location updates');
    event.waitUntil(syncQueuedLocations());
  }
});

// Sync queued location updates
async function syncQueuedLocations() {
  // Respect the 429 backoff gate before touching the queue again.
  if (Date.now() < locationFlushBackoffUntil) {
    return;
  }
  try {
    const queuedRequests = await getQueuedRequests();
    console.log(`Syncing ${queuedRequests.length} queued location updates`);

    for (let i = 0; i < queuedRequests.length; i++) {
      const requestData = queuedRequests[i];
      if (!(Date.now() - requestData.timestamp < LOCATION_REPLAY_MAX_AGE_MS)) {
        await removeQueuedRequest(requestData.id);
        continue;
      }
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });

        if (response.ok) {
          await removeQueuedRequest(requestData.id);
          console.log('Successfully synced location update:', requestData.id);
        } else if (response.status === 429) {
          // Rate limited: stop the flush, keep the rest of the queue intact,
          // and gate the next attempt (~30s). The next sync retries it.
          locationFlushBackoffUntil = Date.now() + LOCATION_FLUSH_429_BACKOFF_MS;
          return;
        }
      } catch (error) {
        console.error('Failed to sync location update:', requestData.id, error);
      }

      // Trickle the queue instead of bursting it into the rate limiter.
      if (i < queuedRequests.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, LOCATION_FLUSH_SPACING_MS));
      }
    }
  } catch (error) {
    console.error('Error during background sync:', error);
  }
}

// Get queued requests from IndexedDB
async function getQueuedRequests() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([LOCATION_QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(LOCATION_QUEUE_STORE);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
}

// Remove successfully synced request
async function removeQueuedRequest(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([LOCATION_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(LOCATION_QUEUE_STORE);
      
      store.delete(id);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

// Message handling for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_QUEUE_STATUS') {
    getQueuedRequests().then((requests) => {
      event.ports[0].postMessage({
        type: 'QUEUE_STATUS',
        count: requests.length,
        requests: requests.map(r => ({ id: r.id, timestamp: r.timestamp }))
      });
    });
  }
});