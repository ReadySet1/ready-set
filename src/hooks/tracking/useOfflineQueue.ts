'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OfflineCapability, OfflineLocationQueue } from '@/types/tracking';

interface UseOfflineQueueReturn {
  offlineStatus: OfflineCapability;
  queuedItems: number;
  registerServiceWorker: () => Promise<void>;
  syncPendingItems: () => Promise<void>;
  syncOfflineData: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  // Initialize with deterministic values for SSR hydration
  const [offlineStatus, setOfflineStatus] = useState<OfflineCapability>({
    isOnline: false,
    pendingUpdates: 0,
    lastSync: undefined,
    syncInProgress: false
  });

  const [queuedItems, setQueuedItems] = useState(0);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered:', registration);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                console.log('New service worker available');
              }
            });
          }
        });

        // Enable background sync if supported
        if ('sync' in window.ServiceWorkerRegistration.prototype) {
          console.log('Background Sync is supported');
        }

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }, []);

  // Get queue status from service worker
  const getQueueStatus = useCallback(async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const messageChannel = new MessageChannel();
        
        return new Promise<number>((resolve) => {
          messageChannel.port1.onmessage = (event) => {
            if (event.data.type === 'QUEUE_STATUS') {
              resolve(event.data.count || 0);
            }
          };

          navigator.serviceWorker.controller?.postMessage(
            { type: 'GET_QUEUE_STATUS' },
            [messageChannel.port2]
          );
        });
      } catch (error) {
        console.error('Error getting queue status:', error);
        return 0;
      }
    }
    return 0;
  }, []);

  // Sync pending items
  const syncPendingItems = useCallback(async () => {
    if ('serviceWorker' in navigator && 'sync' in (window as any).ServiceWorkerRegistration.prototype) {
      try {
        setOfflineStatus(prev => ({ ...prev, syncInProgress: true }));
        
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('location-sync');
        
        console.log('Background sync registered');
        
        // Update sync time
        setOfflineStatus(prev => ({ 
          ...prev, 
          syncInProgress: false,
          lastSync: new Date()
        }));
      } catch (error) {
        console.error('Background sync registration failed:', error);
        setOfflineStatus(prev => ({ ...prev, syncInProgress: false }));
      }
    }
  }, []);

  // Sync offline data (alias for syncPendingItems)
  const syncOfflineData = useCallback(async () => {
    await syncPendingItems();
  }, [syncPendingItems]);

  // Monitor online/offline status
  useEffect(() => {
    // Set actual status on mount to avoid SSR/client mismatch
    try {
      const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      setOfflineStatus(prev => ({ ...prev, isOnline: initialOnline }));
    } catch {
      // no-op
    }

    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      setOfflineStatus(prev => ({ ...prev, isOnline }));
      
      // Automatically sync when coming back online
      if (isOnline && offlineStatus.pendingUpdates > 0) {
        syncPendingItems();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [syncPendingItems, offlineStatus.pendingUpdates]);

  // Periodically check queue status
  useEffect(() => {
    const checkQueueStatus = async () => {
      const count = await getQueueStatus();
      setQueuedItems(count);
      setOfflineStatus(prev => ({ ...prev, pendingUpdates: count }));
    };

    checkQueueStatus();
    
    const interval = setInterval(checkQueueStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [getQueueStatus]);

  // Register service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  return {
    offlineStatus,
    queuedItems,
    registerServiceWorker,
    syncPendingItems,
    syncOfflineData
  };
}