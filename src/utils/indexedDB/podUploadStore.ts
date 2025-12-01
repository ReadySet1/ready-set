// src/utils/indexedDB/podUploadStore.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Stored POD upload structure for offline queue
 */
export interface StoredPODUpload {
  id: string;
  deliveryId: string;
  orderNumber: string;
  fileData: ArrayBuffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string; // ISO string for storage
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: string; // ISO string
  uploadEndpoint: string;
  metadata?: {
    capturedAt: string;
    compressionApplied: boolean;
    originalSize?: number;
  };
}

/**
 * IndexedDB schema for POD upload offline storage
 */
interface PODDB extends DBSchema {
  // @ts-expect-error - Known idb type limitation with string literal object store names
  'pod-uploads': {
    key: string;
    value: StoredPODUpload;
    indexes: {
      'by-synced': boolean;
      'by-delivery': string;
      'by-created': string;
    };
  };
}

/**
 * PODUploadStore - Manages offline storage of POD photo uploads using IndexedDB
 *
 * This provides offline-first photo uploads with automatic sync when online.
 * Failed uploads are stored locally and synced when connection is restored.
 */
export class PODUploadStore {
  private db: IDBPDatabase<PODDB> | null = null;
  private readonly DB_NAME = 'pod-uploads';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'pod-uploads';

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return; // Already initialized

    try {
      this.db = await openDB<PODDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('pod-uploads')) {
            const store = db.createObjectStore('pod-uploads', {
              keyPath: 'id'
            });

            // Create indexes for efficient queries
            store.createIndex('by-synced', 'synced');
            store.createIndex('by-delivery', 'deliveryId');
            store.createIndex('by-created', 'createdAt');
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize PODUploadStore:', error);
      throw error;
    }
  }

  /**
   * Add a POD upload to offline storage
   */
  async addPODUpload(
    deliveryId: string,
    orderNumber: string,
    file: File,
    uploadEndpoint: string,
    metadata?: { capturedAt?: Date; compressionApplied?: boolean; originalSize?: number }
  ): Promise<string> {
    if (!this.db) await this.init();

    try {
      const id = `pod-${deliveryId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Convert file to ArrayBuffer for storage
      const fileData = await file.arrayBuffer();

      await this.db!.add(this.STORE_NAME, {
        id,
        deliveryId,
        orderNumber,
        fileData,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
        synced: false,
        syncAttempts: 0,
        uploadEndpoint,
        metadata: metadata ? {
          capturedAt: metadata.capturedAt?.toISOString() || new Date().toISOString(),
          compressionApplied: metadata.compressionApplied ?? false,
          originalSize: metadata.originalSize,
        } : undefined,
      });

      return id;
    } catch (error) {
      console.error('Failed to add POD upload to offline storage:', error);
      throw error;
    }
  }

  /**
   * Get all unsynced POD uploads
   */
  async getUnsyncedUploads(): Promise<StoredPODUpload[]> {
    if (!this.db) await this.init();

    try {
      const uploads = await this.db!.getAllFromIndex(
        this.STORE_NAME,
        'by-synced',
        false
      );
      return uploads;
    } catch (error) {
      console.error('Failed to get unsynced POD uploads:', error);
      return [];
    }
  }

  /**
   * Get unsynced uploads for a specific delivery
   */
  async getUnsyncedUploadsByDelivery(deliveryId: string): Promise<StoredPODUpload[]> {
    if (!this.db) await this.init();

    try {
      const allUploads = await this.db!.getAllFromIndex(
        this.STORE_NAME,
        'by-delivery',
        deliveryId
      );
      return allUploads.filter(upload => !upload.synced);
    } catch (error) {
      console.error('Failed to get unsynced uploads for delivery:', error);
      return [];
    }
  }

  /**
   * Get a specific upload by ID
   */
  async getUpload(id: string): Promise<StoredPODUpload | undefined> {
    if (!this.db) await this.init();

    try {
      return await this.db!.get(this.STORE_NAME, id);
    } catch (error) {
      console.error('Failed to get POD upload:', error);
      return undefined;
    }
  }

  /**
   * Mark a POD upload as synced
   */
  async markAsSynced(id: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      const upload = await this.db!.get(this.STORE_NAME, id);
      if (upload) {
        upload.synced = true;
        await this.db!.put(this.STORE_NAME, upload);
      }
    } catch (error) {
      console.error('Failed to mark POD upload as synced:', error);
      throw error;
    }
  }

  /**
   * Increment sync attempt counter for a POD upload
   */
  async incrementSyncAttempts(id: string): Promise<number> {
    if (!this.db) await this.init();

    try {
      const upload = await this.db!.get(this.STORE_NAME, id);
      if (upload) {
        upload.syncAttempts++;
        upload.lastSyncAttempt = new Date().toISOString();
        await this.db!.put(this.STORE_NAME, upload);
        return upload.syncAttempts;
      }
      return 0;
    } catch (error) {
      console.error('Failed to increment sync attempts:', error);
      throw error;
    }
  }

  /**
   * Delete a POD upload from storage
   */
  async deleteUpload(id: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      await this.db!.delete(this.STORE_NAME, id);
    } catch (error) {
      console.error('Failed to delete POD upload:', error);
      throw error;
    }
  }

  /**
   * Get count of unsynced POD uploads
   */
  async getUnsyncedCount(): Promise<number> {
    if (!this.db) await this.init();

    try {
      const uploads = await this.getUnsyncedUploads();
      return uploads.length;
    } catch (error) {
      console.error('Failed to get unsynced count:', error);
      return 0;
    }
  }

  /**
   * Clear old synced uploads (cleanup)
   * Removes synced uploads older than the specified number of days
   */
  async clearOldSyncedUploads(daysOld: number = 7): Promise<number> {
    if (!this.db) await this.init();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = cutoffDate.toISOString();

      const allUploads = await this.db!.getAll(this.STORE_NAME);
      let deletedCount = 0;

      for (const upload of allUploads) {
        if (upload.synced && upload.createdAt < cutoffTimestamp) {
          await this.db!.delete(this.STORE_NAME, upload.id);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to clear old synced POD uploads:', error);
      return 0;
    }
  }

  /**
   * Remove uploads that have exceeded max sync attempts
   */
  async clearFailedUploads(maxAttempts: number = 10): Promise<number> {
    if (!this.db) await this.init();

    try {
      const allUploads = await this.db!.getAll(this.STORE_NAME);
      let deletedCount = 0;

      for (const upload of allUploads) {
        if (!upload.synced && upload.syncAttempts >= maxAttempts) {
          await this.db!.delete(this.STORE_NAME, upload.id);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to clear failed POD uploads:', error);
      return 0;
    }
  }

  /**
   * Convert stored upload back to a File object for syncing
   */
  storedUploadToFile(upload: StoredPODUpload): File {
    const blob = new Blob([upload.fileData], { type: upload.fileType });
    return new File([blob], upload.fileName, { type: upload.fileType });
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance for app-wide use
let podUploadStoreInstance: PODUploadStore | null = null;

/**
 * Get the singleton PODUploadStore instance
 */
export function getPODUploadStore(): PODUploadStore {
  if (!podUploadStoreInstance) {
    podUploadStoreInstance = new PODUploadStore();
  }
  return podUploadStoreInstance;
}
