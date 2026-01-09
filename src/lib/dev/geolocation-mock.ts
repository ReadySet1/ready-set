/**
 * Geolocation API Mock for Development Testing
 *
 * This module provides a mock implementation of the browser's Geolocation API
 * that can simulate a driver moving along a route. It's designed to work
 * seamlessly with the existing useLocationTracking hook.
 *
 * DEVELOPMENT ONLY - This should never be used in production.
 */

export interface SimulatedPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  heading: number;
  altitude?: number;
}

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
}

type PositionCallback = (position: GeolocationPosition) => void;
type PositionErrorCallback = (error: GeolocationPositionError) => void;

interface WatchEntry {
  successCallback: PositionCallback;
  errorCallback?: PositionErrorCallback;
  options?: PositionOptions;
}

// Store the original geolocation API
let originalGeolocation: Geolocation | null = null;

// Simulation state
let isSimulating = false;
let currentPosition: SimulatedPosition | null = null;
let route: RouteWaypoint[] = [];
let currentWaypointIndex = 0;
let progress = 0; // 0 to 1 between waypoints
let speedMultiplier = 1;
let baseSpeedMps = 13.4; // ~30 mph in m/s
let simulationInterval: NodeJS.Timeout | null = null;
let watchIdCounter = 0;
let activeWatches: Map<number, WatchEntry> = new Map();

// Event callbacks for external state management
let onPositionUpdate: ((position: SimulatedPosition) => void) | null = null;
let onSimulationEnd: (() => void) | null = null;

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bearing between two points
 */
function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const x = Math.sin(dLon) * Math.cos(lat2Rad);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Interpolate between two waypoints
 */
function interpolatePosition(
  from: RouteWaypoint,
  to: RouteWaypoint,
  t: number
): { latitude: number; longitude: number } {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

/**
 * Create a GeolocationPosition object from simulated position
 */
function createGeolocationPosition(pos: SimulatedPosition): GeolocationPosition {
  const coords: GeolocationCoordinates = {
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracy: pos.accuracy,
    altitude: pos.altitude ?? null,
    altitudeAccuracy: null,
    heading: pos.heading,
    speed: pos.speed,
    toJSON() {
      return {
        latitude: this.latitude,
        longitude: this.longitude,
        accuracy: this.accuracy,
        altitude: this.altitude,
        altitudeAccuracy: this.altitudeAccuracy,
        heading: this.heading,
        speed: this.speed,
      };
    },
  };
  const timestamp = Date.now();
  return {
    coords,
    timestamp,
    toJSON() {
      return {
        coords: coords.toJSON(),
        timestamp,
      };
    },
  };
}

/**
 * Update simulation state and notify watchers
 */
function updateSimulation(): void {
  if (!isSimulating || route.length < 2) return;

  const currentWaypoint = route[currentWaypointIndex];
  const nextWaypoint = route[currentWaypointIndex + 1];

  if (!currentWaypoint || !nextWaypoint) {
    // Reached end of route or invalid state
    stopSimulation();
    onSimulationEnd?.();
    return;
  }

  // Calculate distance between current and next waypoint
  const segmentDistance = haversineDistance(
    currentWaypoint.latitude,
    currentWaypoint.longitude,
    nextWaypoint.latitude,
    nextWaypoint.longitude
  );

  // Calculate how much progress per second at current speed
  const speedMps = baseSpeedMps * speedMultiplier;
  const progressPerSecond = segmentDistance > 0 ? speedMps / segmentDistance : 1;

  // Update progress
  progress += progressPerSecond;

  // Check if we've reached the next waypoint
  if (progress >= 1) {
    currentWaypointIndex++;
    progress = 0;

    if (currentWaypointIndex >= route.length - 1) {
      // Reached end of route
      const lastWaypoint = route[route.length - 1];
      if (lastWaypoint) {
        currentPosition = {
          latitude: lastWaypoint.latitude,
          longitude: lastWaypoint.longitude,
          accuracy: 10,
          speed: 0,
          heading: currentPosition?.heading ?? 0,
        };
      }
      stopSimulation();
      onSimulationEnd?.();
      return;
    }
  }

  // Calculate interpolated position
  const from = route[currentWaypointIndex];
  const to = route[currentWaypointIndex + 1];

  if (!from || !to) {
    stopSimulation();
    return;
  }

  const interpolated = interpolatePosition(from, to, progress);

  // Calculate heading to next waypoint
  const heading = calculateBearing(
    interpolated.latitude,
    interpolated.longitude,
    to.latitude,
    to.longitude
  );

  // Update current position
  currentPosition = {
    latitude: interpolated.latitude,
    longitude: interpolated.longitude,
    accuracy: 10 + Math.random() * 5, // Simulate slight accuracy variation
    speed: speedMps,
    heading,
  };

  // Notify external listener
  onPositionUpdate?.(currentPosition);

  // Notify all active watches
  const geoPosition = createGeolocationPosition(currentPosition);
  activeWatches.forEach((watch) => {
    try {
      watch.successCallback(geoPosition);
    } catch (e) {
      console.error('[LocationSimulator] Error in watch callback:', e);
    }
  });
}

/**
 * Mock Geolocation implementation
 */
const mockGeolocation: Geolocation = {
  getCurrentPosition(
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    _options?: PositionOptions
  ): void {
    // If we have a current position (from simulation), use it
    if (currentPosition) {
      const position = createGeolocationPosition(currentPosition);
      setTimeout(() => successCallback(position), 50); // Simulate async
      return;
    }

    // No position yet - fall back to original or error
    if (originalGeolocation) {
      originalGeolocation.getCurrentPosition(
        successCallback,
        errorCallback ?? undefined,
        _options
      );
    } else if (errorCallback) {
      errorCallback({
        code: 2,
        message: 'Simulation not active and no original geolocation available',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    }
  },

  watchPosition(
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    options?: PositionOptions
  ): number {
    const watchId = ++watchIdCounter;

    // Always store the watch callback so simulation updates work when started
    activeWatches.set(watchId, {
      successCallback,
      errorCallback: errorCallback ?? undefined,
      options,
    });

    // If we have a simulated position, use it immediately
    if (currentPosition) {
      const position = createGeolocationPosition(currentPosition);
      setTimeout(() => successCallback(position), 50);
    } else if (originalGeolocation) {
      // No simulation position yet - get real position as fallback
      // This allows the app to work normally until simulation starts
      originalGeolocation.getCurrentPosition(
        (position) => {
          // Only call if we still don't have a simulated position
          if (!currentPosition) {
            successCallback(position);
          }
        },
        errorCallback ?? undefined,
        options
      );
    }

    return watchId;
  },

  clearWatch(watchId: number): void {
    if (activeWatches.has(watchId)) {
      activeWatches.delete(watchId);
    } else if (originalGeolocation) {
      originalGeolocation.clearWatch(watchId);
    }
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Custom event name for geolocation mock state changes
 * Components can listen to this to restart their watches
 */
export const GEOLOCATION_MOCK_EVENT = 'geolocation-mock-state-changed';

/**
 * Enable the geolocation mock (replaces navigator.geolocation)
 */
export function enableMock(): void {
  if (typeof window === 'undefined') return;
  if (originalGeolocation) return; // Already enabled

  originalGeolocation = navigator.geolocation;

  // Replace navigator.geolocation with our mock
  Object.defineProperty(navigator, 'geolocation', {
    value: mockGeolocation,
    configurable: true,
    writable: true,
  });

  console.log('[LocationSimulator] Geolocation mock enabled');

  // Dispatch event so tracking hooks can restart their watches
  window.dispatchEvent(new CustomEvent(GEOLOCATION_MOCK_EVENT, { detail: { enabled: true } }));
}

/**
 * Disable the geolocation mock (restores original)
 */
export function disableMock(): void {
  if (typeof window === 'undefined') return;
  if (!originalGeolocation) return;

  stopSimulation();

  Object.defineProperty(navigator, 'geolocation', {
    value: originalGeolocation,
    configurable: true,
    writable: true,
  });

  originalGeolocation = null;
  console.log('[LocationSimulator] Geolocation mock disabled');

  // Dispatch event so tracking hooks can restart their watches with real geolocation
  window.dispatchEvent(new CustomEvent(GEOLOCATION_MOCK_EVENT, { detail: { enabled: false } }));
}

/**
 * Check if mock is currently enabled
 */
export function isMockEnabled(): boolean {
  return originalGeolocation !== null;
}

/**
 * Set the route waypoints for simulation
 */
export function setRoute(waypoints: RouteWaypoint[]): void {
  route = waypoints;
  currentWaypointIndex = 0;
  progress = 0;

  const firstWaypoint = waypoints[0];
  if (firstWaypoint) {
    currentPosition = {
      latitude: firstWaypoint.latitude,
      longitude: firstWaypoint.longitude,
      accuracy: 10,
      speed: 0,
      heading: 0,
    };

    // Notify all active watchers about the new position
    const geoPosition = createGeolocationPosition(currentPosition);
    activeWatches.forEach((watch) => {
      try {
        watch.successCallback(geoPosition);
      } catch (e) {
        console.error('[LocationSimulator] Error in watch callback:', e);
      }
    });

    // Also dispatch event so tracking hooks can update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GEOLOCATION_MOCK_EVENT, { detail: { enabled: true, routeSet: true } }));
    }
  }
}

/**
 * Set the speed multiplier (1x, 2x, 5x, etc.)
 */
export function setSpeedMultiplier(multiplier: number): void {
  speedMultiplier = Math.max(0.5, Math.min(20, multiplier));
}

/**
 * Get current speed multiplier
 */
export function getSpeedMultiplier(): number {
  return speedMultiplier;
}

/**
 * Start the simulation
 */
export function startSimulation(): void {
  if (isSimulating) return;
  if (route.length < 2) {
    console.warn('[LocationSimulator] Cannot start simulation without a route');
    return;
  }

  const firstWaypoint = route[0];
  const secondWaypoint = route[1];

  if (!firstWaypoint || !secondWaypoint) {
    console.warn('[LocationSimulator] Invalid route waypoints');
    return;
  }

  isSimulating = true;

  // Initialize position at start of route
  currentPosition = {
    latitude: firstWaypoint.latitude,
    longitude: firstWaypoint.longitude,
    accuracy: 10,
    speed: baseSpeedMps * speedMultiplier,
    heading: calculateBearing(
      firstWaypoint.latitude,
      firstWaypoint.longitude,
      secondWaypoint.latitude,
      secondWaypoint.longitude
    ),
  };

  // Update every second
  simulationInterval = setInterval(updateSimulation, 1000);

  // Immediately notify watchers
  const geoPosition = createGeolocationPosition(currentPosition);
  activeWatches.forEach((watch) => {
    try {
      watch.successCallback(geoPosition);
    } catch (e) {
      console.error('[LocationSimulator] Error in watch callback:', e);
    }
  });

  console.log('[LocationSimulator] Simulation started');

  // Dispatch event so any components can react to simulation starting
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GEOLOCATION_MOCK_EVENT, { detail: { enabled: true, simulating: true } }));
  }
}

/**
 * Stop the simulation
 */
export function stopSimulation(): void {
  if (!isSimulating) return;

  isSimulating = false;

  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  console.log('[LocationSimulator] Simulation stopped');
}

/**
 * Pause the simulation (keeps position but stops updates)
 */
export function pauseSimulation(): void {
  if (!isSimulating) return;

  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  // Update position to show stopped
  if (currentPosition) {
    currentPosition.speed = 0;
  }

  console.log('[LocationSimulator] Simulation paused');
}

/**
 * Resume a paused simulation
 */
export function resumeSimulation(): void {
  if (!isSimulating || simulationInterval) return;

  simulationInterval = setInterval(updateSimulation, 1000);
  console.log('[LocationSimulator] Simulation resumed');
}

/**
 * Check if simulation is currently running
 */
export function isSimulationRunning(): boolean {
  return isSimulating && simulationInterval !== null;
}

/**
 * Check if simulation is paused
 */
export function isSimulationPaused(): boolean {
  return isSimulating && simulationInterval === null;
}

/**
 * Get current simulated position
 */
export function getCurrentPosition(): SimulatedPosition | null {
  return currentPosition;
}

/**
 * Get simulation progress (0-100%)
 */
export function getSimulationProgress(): number {
  if (route.length < 2) return 0;
  const waypointProgress = currentWaypointIndex / (route.length - 1);
  const segmentProgress = progress / (route.length - 1);
  return Math.min(100, (waypointProgress + segmentProgress) * 100);
}

/**
 * Set callback for position updates
 */
export function onPosition(callback: ((position: SimulatedPosition) => void) | null): void {
  onPositionUpdate = callback;
}

/**
 * Set callback for when simulation ends
 */
export function onEnd(callback: (() => void) | null): void {
  onSimulationEnd = callback;
}

/**
 * Reset simulation to beginning of route
 */
export function resetSimulation(): void {
  stopSimulation();
  currentWaypointIndex = 0;
  progress = 0;

  const firstWaypoint = route[0];
  const secondWaypoint = route[1];

  if (firstWaypoint) {
    currentPosition = {
      latitude: firstWaypoint.latitude,
      longitude: firstWaypoint.longitude,
      accuracy: 10,
      speed: 0,
      heading:
        secondWaypoint
          ? calculateBearing(
              firstWaypoint.latitude,
              firstWaypoint.longitude,
              secondWaypoint.latitude,
              secondWaypoint.longitude
            )
          : 0,
    };
  }
}

/**
 * Jump to a specific position along the route (0-100%)
 */
export function jumpToProgress(percent: number): void {
  if (route.length < 2) return;

  const normalizedPercent = Math.max(0, Math.min(100, percent)) / 100;
  const totalSegments = route.length - 1;
  const exactPosition = normalizedPercent * totalSegments;

  currentWaypointIndex = Math.min(Math.floor(exactPosition), totalSegments - 1);
  progress = exactPosition - currentWaypointIndex;

  // Update position
  const from = route[currentWaypointIndex];
  const to = route[currentWaypointIndex + 1] ?? from;

  if (!from || !to) return;

  const interpolated = interpolatePosition(from, to, progress);

  currentPosition = {
    latitude: interpolated.latitude,
    longitude: interpolated.longitude,
    accuracy: 10,
    speed: isSimulating ? baseSpeedMps * speedMultiplier : 0,
    heading: calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude),
  };

  // Notify watchers if simulating
  if (isSimulating && currentPosition) {
    const geoPosition = createGeolocationPosition(currentPosition);
    activeWatches.forEach((watch) => {
      try {
        watch.successCallback(geoPosition);
      } catch (e) {
        console.error('[LocationSimulator] Error in watch callback:', e);
      }
    });
    onPositionUpdate?.(currentPosition);
  }
}
