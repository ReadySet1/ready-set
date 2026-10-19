/**
 * In-memory stand-in for the IndexedDB LocationStore
 * (src/utils/indexedDB/locationStore.ts), for tests of the location outbox.
 *
 * `rows` survives a simulated page reload when the test keeps the same
 * instance across `jest.resetModules()` / `jest.isolateModules()` — the way
 * IndexedDB survives a reload on the phone.
 */
import type { LocationUpdate } from '@/types/tracking';
import type { StoredLocationUpdate } from '@/utils/indexedDB/locationStore';

export class MemoryLocationStore {
  rows = new Map<string, StoredLocationUpdate>();
  private seq = 0;
  failWrites = false;

  async init(): Promise<void> {}

  async addLocation(location: LocationUpdate): Promise<void> {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.seq += 1;
    const id = `${location.driverId}-${String(this.seq).padStart(8, '0')}`;
    this.rows.set(id, {
      id,
      driverId: location.driverId,
      coordinates: location.coordinates,
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      altitude: location.altitude,
      batteryLevel: location.batteryLevel,
      activityType: location.activityType ?? 'stationary',
      isMoving: location.isMoving ?? false,
      timestamp: location.timestamp.toISOString(),
      synced: false,
      syncAttempts: 0,
    });
  }

  async getUnsyncedLocations(): Promise<StoredLocationUpdate[]> {
    return [...this.rows.values()].filter((r) => !r.synced).map((r) => ({ ...r }));
  }

  async getUnsyncedCount(): Promise<number> {
    return (await this.getUnsyncedLocations()).length;
  }

  async deleteLocations(ids: string[]): Promise<void> {
    for (const id of ids) this.rows.delete(id);
  }

  async deleteLocation(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async markAsSynced(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.synced = true;
  }

  async clearOldSyncedLocations(): Promise<number> {
    return 0;
  }

  /** Pending fix times, oldest first. */
  pendingTimestamps(): string[] {
    return [...this.rows.values()]
      .filter((r) => !r.synced)
      .map((r) => r.timestamp)
      .sort();
  }
}
