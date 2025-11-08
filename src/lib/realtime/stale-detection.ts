/**
 * Stale Location Detection
 *
 * Monitors driver location updates and identifies drivers who haven't
 * sent location data within the configured threshold (default 5 minutes).
 *
 * This helps identify:
 * - Drivers who may have lost connection
 * - Inactive or offline drivers still showing as "online"
 * - Potential app crashes or background processing issues
 */

import { realtimeLogger } from '../logging/realtime-logger';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Time threshold in milliseconds after which a driver is considered stale
 * Default: 5 minutes (300,000ms)
 */
export const STALE_LOCATION_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Interval for checking stale locations
 * Default: 1 minute (60,000ms)
 */
export const STALE_CHECK_INTERVAL_MS = 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface DriverLocationState {
  driverId: string;
  driverName?: string;
  lastLocationAt: Date;
  lat: number;
  lng: number;
  isStale: boolean;
}

export interface StaleLocationReport {
  staleDrivers: DriverLocationState[];
  activeDrivers: DriverLocationState[];
  totalDrivers: number;
  stalePercentage: number;
  checkTime: Date;
}

// ============================================================================
// Stale Location Detector
// ============================================================================

export class StaleLocationDetector {
  private driverLocations: Map<string, DriverLocationState> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private staleThresholdMs: number;
  private onStaleCallback?: (report: StaleLocationReport) => void;

  constructor(
    staleThresholdMs: number = STALE_LOCATION_THRESHOLD_MS,
    onStaleCallback?: (report: StaleLocationReport) => void,
  ) {
    this.staleThresholdMs = staleThresholdMs;
    this.onStaleCallback = onStaleCallback;
  }

  /**
   * Record a location update from a driver
   */
  recordLocation(
    driverId: string,
    lat: number,
    lng: number,
    driverName?: string,
  ): void {
    const now = new Date();

    const existing = this.driverLocations.get(driverId);
    const wasStale = existing?.isStale ?? false;

    this.driverLocations.set(driverId, {
      driverId,
      driverName: driverName || existing?.driverName,
      lastLocationAt: now,
      lat,
      lng,
      isStale: false,
    });

    // Log if driver was previously stale and is now active again
    if (wasStale) {
      realtimeLogger.info('Driver location recovered from stale state', {
        metadata: {
          driverId,
          driverName,
          lastSeen: existing?.lastLocationAt,
        },
      });
    }
  }

  /**
   * Check for stale locations and update state
   * Returns a report of stale and active drivers
   */
  checkStaleLocations(): StaleLocationReport {
    const now = new Date();
    const staleDrivers: DriverLocationState[] = [];
    const activeDrivers: DriverLocationState[] = [];

    for (const [driverId, state] of this.driverLocations.entries()) {
      const timeSinceLastLocation = now.getTime() - state.lastLocationAt.getTime();
      const isStale = timeSinceLastLocation > this.staleThresholdMs;

      // Update stale status
      state.isStale = isStale;

      if (isStale) {
        staleDrivers.push(state);

        realtimeLogger.warn('Stale driver location detected', {
          metadata: {
            driverId: state.driverId,
            driverName: state.driverName,
            lastLocationAt: state.lastLocationAt.toISOString(),
            minutesSinceLastUpdate: Math.round(timeSinceLastLocation / (60 * 1000)),
          },
        });
      } else {
        activeDrivers.push(state);
      }
    }

    const report: StaleLocationReport = {
      staleDrivers,
      activeDrivers,
      totalDrivers: this.driverLocations.size,
      stalePercentage: this.driverLocations.size > 0
        ? (staleDrivers.length / this.driverLocations.size) * 100
        : 0,
      checkTime: now,
    };

    // Call callback if provided
    if (this.onStaleCallback && staleDrivers.length > 0) {
      this.onStaleCallback(report);
    }

    return report;
  }

  /**
   * Get the current stale status for a specific driver
   */
  getDriverStatus(driverId: string): DriverLocationState | null {
    return this.driverLocations.get(driverId) || null;
  }

  /**
   * Check if a specific driver has stale location data
   */
  isDriverStale(driverId: string): boolean {
    const state = this.driverLocations.get(driverId);
    if (!state) {
      return false; // No data = not tracked yet
    }

    const timeSinceLastLocation = Date.now() - state.lastLocationAt.getTime();
    return timeSinceLastLocation > this.staleThresholdMs;
  }

  /**
   * Start automatic stale location checking
   * Runs every STALE_CHECK_INTERVAL_MS
   */
  startMonitoring(intervalMs: number = STALE_CHECK_INTERVAL_MS): void {
    if (this.checkInterval) {
      realtimeLogger.warn('Stale location monitoring already running');
      return;
    }

    realtimeLogger.info('Starting stale location monitoring', {
      metadata: {
        intervalMs,
        thresholdMs: this.staleThresholdMs,
        thresholdMinutes: this.staleThresholdMs / (60 * 1000),
      },
    });

    this.checkInterval = setInterval(() => {
      this.checkStaleLocations();
    }, intervalMs);
  }

  /**
   * Stop automatic stale location checking
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;

      realtimeLogger.info('Stopped stale location monitoring');
    }
  }

  /**
   * Remove a driver from tracking
   */
  removeDriver(driverId: string): void {
    this.driverLocations.delete(driverId);
  }

  /**
   * Clear all tracked locations
   */
  clear(): void {
    this.driverLocations.clear();
  }

  /**
   * Get the total number of tracked drivers
   */
  get trackedDriverCount(): number {
    return this.driverLocations.size;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Global stale location detector instance
 * Can be configured with a callback to handle stale driver notifications
 */
export const staleLocationDetector = new StaleLocationDetector();
