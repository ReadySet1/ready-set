'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPODUploadStore, StoredPODUpload } from '@/utils/indexedDB/podUploadStore';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

/**
 * Offline status for POD uploads
 */
export interface PODOfflineStatus {
  isOnline: boolean;
  pendingUploads: number;
  syncInProgress: boolean;
  lastSync?: Date;
}

/**
 * Result of a sync operation
 */
export interface PODSyncResult {
  id: string;
  deliveryId: string;
  success: boolean;
  error?: string;
  url?: string;
}

/**
 * Return type for usePODOfflineQueue hook
 */
export interface UsePODOfflineQueueReturn {
  offlineStatus: PODOfflineStatus;
  queuePODUpload: (
    deliveryId: string,
    orderNumber: string,
    file: File,
    uploadEndpoint: string,
    metadata?: { capturedAt?: Date; compressionApplied?: boolean; originalSize?: number }
  ) => Promise<string>;
  syncPendingUploads: () => Promise<PODSyncResult[]>;
  getPendingCount: () => Promise<number>;
  getPendingUploads: () => Promise<StoredPODUpload[]>;
  cancelPendingUpload: (id: string) => Promise<void>;
}

const MAX_SYNC_ATTEMPTS = 10;
const CLEANUP_DAYS = 7;
const SYNC_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Hook for managing offline POD upload queue
 *
 * Provides functionality to:
 * - Queue photo uploads when offline
 * - Automatically sync when connection is restored
 * - Track pending uploads count
 * - Retry failed uploads
 */
export function usePODOfflineQueue(): UsePODOfflineQueueReturn {
  const [offlineStatus, setOfflineStatus] = useState<PODOfflineStatus>({
    isOnline: true, // Optimistic default
    pendingUploads: 0,
    syncInProgress: false,
    lastSync: undefined,
  });

  const syncInProgressRef = useRef(false);
  const storeRef = useRef(getPODUploadStore());

  /**
   * Get count of pending uploads
   */
  const getPendingCount = useCallback(async (): Promise<number> => {
    try {
      const store = storeRef.current;
      await store.init();
      return await store.getUnsyncedCount();
    } catch (error) {
      console.error('Error getting pending count:', error);
      return 0;
    }
  }, []);

  /**
   * Get all pending uploads
   */
  const getPendingUploads = useCallback(async (): Promise<StoredPODUpload[]> => {
    try {
      const store = storeRef.current;
      await store.init();
      return await store.getUnsyncedUploads();
    } catch (error) {
      console.error('Error getting pending uploads:', error);
      return [];
    }
  }, []);

  /**
   * Queue a POD upload for later sync
   */
  const queuePODUpload = useCallback(async (
    deliveryId: string,
    orderNumber: string,
    file: File,
    uploadEndpoint: string,
    metadata?: { capturedAt?: Date; compressionApplied?: boolean; originalSize?: number }
  ): Promise<string> => {
    try {
      const store = storeRef.current;
      await store.init();

      const id = await store.addPODUpload(
        deliveryId,
        orderNumber,
        file,
        uploadEndpoint,
        metadata
      );

      addSentryBreadcrumb('POD upload queued', {
        deliveryId,
        fileSize: file.size,
        queueId: id,
      });

      // Update pending count
      const count = await store.getUnsyncedCount();
      setOfflineStatus(prev => ({ ...prev, pendingUploads: count }));

      return id;
    } catch (error) {
      console.error('Error queueing POD upload:', error);
      captureException(error, {
        action: 'queue_pod_upload',
        feature: 'offline_pod',
        component: 'usePODOfflineQueue',
      });
      throw error;
    }
  }, []);

  /**
   * Sync a single pending upload
   */
  const syncSingleUpload = useCallback(async (upload: StoredPODUpload): Promise<PODSyncResult> => {
    const store = storeRef.current;

    try {
      // Convert stored data back to File
      const file = store.storedUploadToFile(upload);

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      if (upload.metadata) {
        formData.append('metadata', JSON.stringify(upload.metadata));
      }

      // Attempt upload
      const response = await fetch(upload.uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const result = await response.json();

      // Mark as synced
      await store.markAsSynced(upload.id);

      addSentryBreadcrumb('POD upload synced', {
        deliveryId: upload.deliveryId,
        queueId: upload.id,
      });

      return {
        id: upload.id,
        deliveryId: upload.deliveryId,
        success: true,
        url: result.url || result.data?.url,
      };
    } catch (error) {
      // Increment sync attempts
      const attempts = await store.incrementSyncAttempts(upload.id);

      // If max attempts exceeded, remove from queue
      if (attempts >= MAX_SYNC_ATTEMPTS) {
        await store.deleteUpload(upload.id);
        captureException(error, {
          action: 'sync_pod_upload_max_attempts',
          feature: 'offline_pod',
          component: 'usePODOfflineQueue',
        });
      }

      return {
        id: upload.id,
        deliveryId: upload.deliveryId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, []);

  /**
   * Sync all pending uploads
   */
  const syncPendingUploads = useCallback(async (): Promise<PODSyncResult[]> => {
    // Prevent concurrent syncs
    if (syncInProgressRef.current) {
      return [];
    }

    syncInProgressRef.current = true;
    setOfflineStatus(prev => ({ ...prev, syncInProgress: true }));

    const results: PODSyncResult[] = [];

    try {
      const store = storeRef.current;
      await store.init();

      const pendingUploads = await store.getUnsyncedUploads();

      for (const upload of pendingUploads) {
        const result = await syncSingleUpload(upload);
        results.push(result);

        // Small delay between uploads to avoid overwhelming the server
        if (pendingUploads.indexOf(upload) < pendingUploads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Cleanup old synced uploads
      await store.clearOldSyncedUploads(CLEANUP_DAYS);

      // Update state
      const remainingCount = await store.getUnsyncedCount();
      setOfflineStatus(prev => ({
        ...prev,
        pendingUploads: remainingCount,
        lastSync: new Date(),
        syncInProgress: false,
      }));

      addSentryBreadcrumb('POD sync completed', {
        total: pendingUploads.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });

      return results;
    } catch (error) {
      console.error('Error syncing pending uploads:', error);
      captureException(error, {
        action: 'sync_pending_uploads',
        feature: 'offline_pod',
      });
      setOfflineStatus(prev => ({ ...prev, syncInProgress: false }));
      return results;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [syncSingleUpload]);

  /**
   * Cancel a pending upload
   */
  const cancelPendingUpload = useCallback(async (id: string): Promise<void> => {
    try {
      const store = storeRef.current;
      await store.init();
      await store.deleteUpload(id);

      // Update count
      const count = await store.getUnsyncedCount();
      setOfflineStatus(prev => ({ ...prev, pendingUploads: count }));
    } catch (error) {
      console.error('Error canceling pending upload:', error);
      throw error;
    }
  }, []);

  /**
   * Update pending count
   */
  const updatePendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setOfflineStatus(prev => ({ ...prev, pendingUploads: count }));
  }, [getPendingCount]);

  // Monitor online/offline status
  useEffect(() => {
    // Set initial status
    if (typeof navigator !== 'undefined') {
      setOfflineStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
    }

    const handleOnline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: true }));

      // Auto-sync when coming back online
      syncPendingUploads();
    };

    const handleOffline = () => {
      setOfflineStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingUploads]);

  // Initialize and periodically check pending count
  useEffect(() => {
    updatePendingCount();

    const interval = setInterval(updatePendingCount, SYNC_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending operations
      syncInProgressRef.current = false;
    };
  }, []);

  return {
    offlineStatus,
    queuePODUpload,
    syncPendingUploads,
    getPendingCount,
    getPendingUploads,
    cancelPendingUpload,
  };
}
