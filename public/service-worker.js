// ReadySet Driver Portal Service Worker
// Provides offline capabilities and background sync for location tracking

const CACHE_NAME = 'readyset-driver-v1';
const STATIC_CACHE_URLS = [
  '/driver/tracking',
  '/manifest.json',
  // Add other essential assets here
];

const LOCATION_QUEUE_STORE = 'location-queue';
const DB_NAME = 'readyset-driver-db';
const DB_VERSION = 1;

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
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

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Handle location update requests specially
  if (event.request.url.includes('/api/tracking/locations')) {
    event.respondWith(handleLocationRequest(event.request));
    return;
  }

  // Handle other requests with cache-first strategy for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request);
        })
        .catch(() => {
          // Return offline page if available
          return caches.match('/driver/tracking');
        })
    );
    return;
  }

  // Default network-first strategy for API calls
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Handle location update requests with offline queue
async function handleLocationRequest(request) {
  try {
    // Try to send immediately
    const response = await fetch(request);
    if (response.ok) {
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
      body: await request.text(),
      timestamp: Date.now()
    };
    
    await storeOfflineRequest(requestData);
    
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
  try {
    const queuedRequests = await getQueuedRequests();
    console.log(`Syncing ${queuedRequests.length} queued location updates`);
    
    for (const requestData of queuedRequests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          await removeQueuedRequest(requestData.id);
          console.log('Successfully synced location update:', requestData.id);
        }
      } catch (error) {
        console.error('Failed to sync location update:', requestData.id, error);
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