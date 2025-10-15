// src/utils/indexedDB/locationStore.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LocationUpdate } from '@/types/tracking';

/**
 * Stored location update structure
 */
export interface StoredLocationUpdate {
  id: string;
  driverId: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  accuracy: number;
  speed: number;
  heading: number;
  altitude?: number;
  batteryLevel?: number;
  activityType: 'walking' | 'driving' | 'stationary';
  isMoving: boolean;
  timestamp: string; // ISO string for storage
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt?: string; // ISO string
}

/**
 * IndexedDB schema for location tracking offline storage
 *
 * Note: The 'location-updates' key uses a string literal type which TypeScript
 * may flag as incompatible with DBSchema's index signature. This is a known
 * limitation of the idb type system and can be safely ignored.
 */
interface LocationDB extends DBSchema {
  // @ts-expect-error - Known idb type limitation with string literal object store names
  'location-updates': {
    key: string;
    value: StoredLocationUpdate;
    indexes: {
      'by-synced': boolean;
      'by-driver-synced': [string, boolean];
      'by-timestamp': string;
    };
  };
}

/**
 * LocationStore - Manages offline storage of location updates using IndexedDB
 *
 * This provides offline-first location tracking with automatic sync when online.
 * Failed location updates are stored locally and synced when connection is restored.
 */
export class LocationStore {
  private db: IDBPDatabase<LocationDB> | null = null;
  private readonly DB_NAME = 'location-tracking';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'location-updates';

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return; // Already initialized

    try {
      this.db = await openDB<LocationDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Create object store if it doesn't exist
          if (!db.objectStoreNames.contains('location-updates')) {
            const store = db.createObjectStore('location-updates', {
              keyPath: 'id'
            });

            // Create indexes for efficient queries
            store.createIndex('by-synced', 'synced');
            store.createIndex('by-driver-synced', ['driverId', 'synced']);
            store.createIndex('by-timestamp', 'timestamp');
          }
        },
      });
    } catch (error) {
      console.error('Failed to initialize LocationStore:', error);
      throw error;
    }
  }

  /**
   * Add a location update to offline storage
   */
  async addLocation(location: LocationUpdate): Promise<void> {
    if (!this.db) await this.init();

    try {
      const id = `${location.driverId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await this.db!.add(this.STORE_NAME, {
        id,
        driverId: location.driverId,
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        altitude: location.altitude,
        batteryLevel: location.batteryLevel,
        activityType: location.activityType ?? 'stationary', // Default to stationary if undefined
        isMoving: location.isMoving ?? false, // Default to false if undefined
        timestamp: location.timestamp.toISOString(),
        synced: false,
        syncAttempts: 0,
      });
    } catch (error) {
      console.error('Failed to add location to offline storage:', error);
      throw error;
    }
  }

  /**
   * Get all unsynced location updates
   */
  async getUnsyncedLocations(): Promise<StoredLocationUpdate[]> {
    if (!this.db) await this.init();

    try {
      const locations = await this.db!.getAllFromIndex(
        this.STORE_NAME,
        'by-synced',
        false
      );
      return locations;
    } catch (error) {
      console.error('Failed to get unsynced locations:', error);
      return [];
    }
  }

  /**
   * Get unsynced locations for a specific driver
   */
  async getUnsyncedLocationsByDriver(driverId: string): Promise<StoredLocationUpdate[]> {
    if (!this.db) await this.init();

    try {
      const locations = await this.db!.getAllFromIndex(
        this.STORE_NAME,
        'by-driver-synced',
        [driverId, false]
      );
      return locations;
    } catch (error) {
      console.error('Failed to get unsynced locations for driver:', error);
      return [];
    }
  }

  /**
   * Mark a location as synced
   */
  async markAsSynced(id: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      const location = await this.db!.get(this.STORE_NAME, id);
      if (location) {
        location.synced = true;
        await this.db!.put(this.STORE_NAME, location);
      }
    } catch (error) {
      console.error('Failed to mark location as synced:', error);
      throw error;
    }
  }

  /**
   * Increment sync attempt counter for a location
   */
  async incrementSyncAttempts(id: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      const location = await this.db!.get(this.STORE_NAME, id);
      if (location) {
        location.syncAttempts++;
        location.lastSyncAttempt = new Date().toISOString();
        await this.db!.put(this.STORE_NAME, location);
      }
    } catch (error) {
      console.error('Failed to increment sync attempts:', error);
      throw error;
    }
  }

  /**
   * Delete a location from storage
   */
  async deleteLocation(id: string): Promise<void> {
    if (!this.db) await this.init();

    try {
      await this.db!.delete(this.STORE_NAME, id);
    } catch (error) {
      console.error('Failed to delete location:', error);
      throw error;
    }
  }

  /**
   * Get count of unsynced locations
   */
  async getUnsyncedCount(): Promise<number> {
    if (!this.db) await this.init();

    try {
      const locations = await this.getUnsyncedLocations();
      return locations.length;
    } catch (error) {
      console.error('Failed to get unsynced count:', error);
      return 0;
    }
  }

  /**
   * Clear old synced locations (cleanup)
   * Removes synced locations older than the specified number of days
   */
  async clearOldSyncedLocations(daysOld: number = 7): Promise<number> {
    if (!this.db) await this.init();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = cutoffDate.toISOString();

      const allLocations = await this.db!.getAll(this.STORE_NAME);
      let deletedCount = 0;

      for (const location of allLocations) {
        if (location.synced && location.timestamp < cutoffTimestamp) {
          await this.db!.delete(this.STORE_NAME, location.id);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to clear old synced locations:', error);
      return 0;
    }
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
let locationStoreInstance: LocationStore | null = null;

/**
 * Get the singleton LocationStore instance
 */
export function getLocationStore(): LocationStore {
  if (!locationStoreInstance) {
    locationStoreInstance = new LocationStore();
  }
  return locationStoreInstance;
}
