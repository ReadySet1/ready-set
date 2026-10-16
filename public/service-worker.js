// ReadySet Driver Portal Service Worker
// Provides offline capabilities and background sync for location tracking

// Bumped from v1: activate deletes every other cache, which clears the stale
// /driver/tracking HTML and authenticated API responses v1 stored on phones.
// Nothing is cached any more; the name only exists so activate can clean up.
const CACHE_NAME = 'readyset-driver-v2';

const LOCATION_ENDPOINT_PATH = '/api/tracking/locations';

const LOCATION_QUEUE_STORE = 'location-queue';
const DB_NAME = 'readyset-driver-db';
const DB_VERSION = 1;

// Flush pacing (mirrors useLocationTracking): trickle queued posts instead of
// bursting them into the server rate limiter, and back off entirely on a 429.
const LOCATION_FLUSH_SPACING_MS = 250;
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

// Fetch event - the SW's only job is the offline location queue.
// Every other request returns without calling respondWith, so the browser
// handles it normally (no caching, no synthetic responses). Calling
// respondWith with a cache miss resolves `undefined`, which Safari reports as
// "FetchEvent.respondWith received an error: Returned response is null".
self.addEventListener('fetch', (event) => {
  if (isLocationPost(event.request)) {
    event.respondWith(handleLocationRequest(event.request));
  }
});

function isLocationPost(request) {
  if (request.method !== 'POST') return false;
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname === LOCATION_ENDPOINT_PATH;
  } catch (error) {
    return false;
  }
}

// Handle location update requests with offline queue
async function handleLocationRequest(request) {
  // fetch() consumes the body, so keep a copy for the offline queue first.
  let body = null;
  try {
    body = await request.clone().text();
  } catch (cloneError) {
    console.error('Could not read location request body:', cloneError);
  }
  try {
    // Try to send immediately
    const response = await fetch(request);
    if (response.ok) {
      return response;
    }
    // Never queue a rate-limited post: replaying it later just repeats the
    // same burst. Hand the 429 back so the client's own throttle handles it.
    if (response.status === 429) {
      return response;
    }
    throw new Error('Network request failed');
  } catch (error) {
    console.log('Location request failed, queuing for later sync:', error);
    
    // Store request in IndexedDB for later sync
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      timestamp: Date.now()
    };
    
    try {
      if (body === null) throw new Error('Request body unavailable');
      await storeOfflineRequest(requestData);
    } catch (storeError) {
      // Never hand respondWith a rejection: answer with a real response so
      // the page sees a normal failed request instead of a Safari error.
      console.error('Could not queue location update:', storeError);
      return new Response(
        JSON.stringify({ success: false, queued: false }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return a synthetic response
    return new Response(
      JSON.stringify({ success: false, queued: true }),
      { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Store failed requests in IndexedDB
async function storeOfflineRequest(requestData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([LOCATION_QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(LOCATION_QUEUE_STORE);
      
      store.add({
        ...requestData,
        id: Date.now() + Math.random()
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCATION_QUEUE_STORE)) {
        db.createObjectStore(LOCATION_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}

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