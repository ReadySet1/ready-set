/**
 * Route Utilities for Location Simulator
 *
 * Provides functions to fetch delivery data, generate routes,
 * and interpolate waypoints for the location simulator.
 *
 * DEVELOPMENT ONLY - This should never be used in production.
 */

import type { RouteWaypoint } from './geolocation-mock';

export interface SimulatorDelivery {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: string;
  pickupAddress: string | null;
  pickupLocation: { lat: number; lng: number } | null;
  deliveryAddress: string;
  deliveryLocation: { lat: number; lng: number } | null;
  priority: string | null;
}

interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

/**
 * Parse GeoJSON Point to lat/lng object
 */
function parseGeoJSONPoint(geojson: GeoJSONPoint | null): { lat: number; lng: number } | null {
  if (!geojson || geojson.type !== 'Point' || !Array.isArray(geojson.coordinates)) {
    return null;
  }
  const [lng, lat] = geojson.coordinates;
  return { lat, lng };
}

/**
 * Fetch active deliveries for the current driver
 */
export async function fetchDriverDeliveries(): Promise<SimulatorDelivery[]> {
  try {
    // Use the tracking deliveries endpoint
    const response = await fetch('/api/tracking/deliveries');
    if (!response.ok) {
      console.error('[LocationSimulator] Failed to fetch deliveries:', response.status);
      return [];
    }

    const json = await response.json();

    // Handle the response structure: { success: true, data: [...] }
    const deliveries = json.data || json.deliveries || json || [];

    return deliveries.map((d: Record<string, unknown>) => {
      // The API returns pickupLocation and deliveryLocation as [lat, lng] arrays
      // (coordinates reversed from GeoJSON format)
      let pickupLoc: { lat: number; lng: number } | null = null;
      let deliveryLoc: { lat: number; lng: number } | null = null;

      // Parse pickup location
      const pickup = d.pickupLocation;
      if (Array.isArray(pickup) && pickup.length === 2) {
        pickupLoc = { lat: pickup[0] as number, lng: pickup[1] as number };
      } else if (pickup && typeof pickup === 'object' && 'lat' in pickup) {
        pickupLoc = pickup as { lat: number; lng: number };
      } else if (d.pickup_location) {
        pickupLoc = parseGeoJSONPoint(d.pickup_location as GeoJSONPoint);
      }

      // Parse delivery location
      const delivery = d.deliveryLocation;
      if (Array.isArray(delivery) && delivery.length === 2) {
        deliveryLoc = { lat: delivery[0] as number, lng: delivery[1] as number };
      } else if (delivery && typeof delivery === 'object' && 'lat' in delivery) {
        deliveryLoc = delivery as { lat: number; lng: number };
      } else if (d.delivery_location) {
        deliveryLoc = parseGeoJSONPoint(d.delivery_location as GeoJSONPoint);
      }

      return {
        id: d.id as string,
        orderNumber: (d.orderNumber as string) || (d.order_number as string) || (d.id as string)?.slice(0, 8) || 'N/A',
        customerName: (d.customerName as string) || (d.customer_name as string) || null,
        status: (d.status as string) || 'unknown',
        pickupAddress: (d.pickupAddress as string) || (d.pickup_address as string) || null,
        pickupLocation: pickupLoc,
        deliveryAddress: (d.deliveryAddress as string) || (d.delivery_address as string) || 'Unknown',
        deliveryLocation: deliveryLoc,
        priority: (d.priority as string) || 'normal',
      };
    });
  } catch (error) {
    console.error('[LocationSimulator] Error fetching deliveries:', error);
    return [];
  }
}

/**
 * Calculate distance between two points using Haversine formula (in meters)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate intermediate waypoints between two points
 * Creates a more realistic route by adding waypoints every ~200 meters
 */
export function generateIntermediateWaypoints(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  intervalMeters: number = 200
): RouteWaypoint[] {
  const waypoints: RouteWaypoint[] = [];
  const totalDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);

  if (totalDistance <= intervalMeters) {
    // Short distance, just use start and end
    return [
      { latitude: start.lat, longitude: start.lng },
      { latitude: end.lat, longitude: end.lng },
    ];
  }

  const numSegments = Math.ceil(totalDistance / intervalMeters);

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;

    // Add slight randomness to make route more realistic (simulate road curves)
    const jitter = i > 0 && i < numSegments ? (Math.random() - 0.5) * 0.0002 : 0;

    waypoints.push({
      latitude: lat + jitter,
      longitude: lng + jitter,
    });
  }

  return waypoints;
}

/**
 * Generate a complete route from pickup to delivery
 */
export function generateDeliveryRoute(delivery: SimulatorDelivery): RouteWaypoint[] {
  const { pickupLocation, deliveryLocation } = delivery;

  if (!pickupLocation || !deliveryLocation) {
    console.warn('[LocationSimulator] Delivery missing location data:', delivery.id);
    return [];
  }

  return generateIntermediateWaypoints(pickupLocation, deliveryLocation);
}

/**
 * Generate a route from current position to delivery (for picked up status)
 */
export function generateRouteToDelivery(
  currentPosition: { lat: number; lng: number },
  delivery: SimulatorDelivery
): RouteWaypoint[] {
  const { deliveryLocation } = delivery;

  if (!deliveryLocation) {
    console.warn('[LocationSimulator] Delivery missing delivery location:', delivery.id);
    return [];
  }

  return generateIntermediateWaypoints(currentPosition, deliveryLocation);
}

/**
 * Generate a route from current position to pickup (for assigned status)
 */
export function generateRouteToPickup(
  currentPosition: { lat: number; lng: number },
  delivery: SimulatorDelivery
): RouteWaypoint[] {
  const { pickupLocation, deliveryLocation } = delivery;

  if (!pickupLocation) {
    console.warn('[LocationSimulator] Delivery missing pickup location:', delivery.id);
    return [];
  }

  // Route: current -> pickup -> delivery
  const toPickup = generateIntermediateWaypoints(currentPosition, pickupLocation);

  if (deliveryLocation) {
    const toDelivery = generateIntermediateWaypoints(pickupLocation, deliveryLocation);
    // Remove duplicate waypoint at pickup
    return [...toPickup, ...toDelivery.slice(1)];
  }

  return toPickup;
}

/**
 * Estimate route duration in seconds based on distance and speed
 */
export function estimateRouteDuration(
  waypoints: RouteWaypoint[],
  speedMps: number = 13.4 // ~30 mph
): number {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];
    if (current && next) {
      totalDistance += calculateDistance(
        current.latitude,
        current.longitude,
        next.latitude,
        next.longitude
      );
    }
  }

  return totalDistance / speedMps;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format distance in meters to human readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)}km`;
}

/**
 * Get total route distance in meters
 */
export function getRouteDistance(waypoints: RouteWaypoint[]): number {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];
    if (current && next) {
      totalDistance += calculateDistance(
        current.latitude,
        current.longitude,
        next.latitude,
        next.longitude
      );
    }
  }

  return totalDistance;
}

// ============================================================================
// Preset Test Routes (for when no active deliveries are available)
// ============================================================================

/**
 * Sample test routes for development
 * These can be used when no real deliveries are available
 */
export const PRESET_ROUTES = {
  // San Francisco downtown loop
  sf_downtown: {
    name: 'SF Downtown Loop',
    description: 'A loop around downtown San Francisco',
    waypoints: [
      { latitude: 37.7749, longitude: -122.4194 }, // Start: Market St
      { latitude: 37.7879, longitude: -122.4074 }, // Financial District
      { latitude: 37.7952, longitude: -122.4028 }, // Embarcadero
      { latitude: 37.8024, longitude: -122.4058 }, // North Beach
      { latitude: 37.7989, longitude: -122.4116 }, // Chinatown
      { latitude: 37.7857, longitude: -122.4115 }, // Union Square
      { latitude: 37.7749, longitude: -122.4194 }, // Back to start
    ] as RouteWaypoint[],
  },

  // Austin downtown to east
  austin_downtown: {
    name: 'Austin Downtown',
    description: 'Downtown Austin to East Austin',
    waypoints: [
      { latitude: 30.2672, longitude: -97.7431 }, // Start: Congress Ave
      { latitude: 30.2678, longitude: -97.7392 }, // Rainey St
      { latitude: 30.2650, longitude: -97.7350 }, // East Austin
      { latitude: 30.2585, longitude: -97.7300 }, // Holly
      { latitude: 30.2520, longitude: -97.7380 }, // South Congress
    ] as RouteWaypoint[],
  },

  // Short test route (for quick testing)
  short_test: {
    name: 'Short Test',
    description: 'A short test route for quick verification',
    waypoints: [
      { latitude: 37.7749, longitude: -122.4194 },
      { latitude: 37.7759, longitude: -122.4184 },
      { latitude: 37.7769, longitude: -122.4174 },
      { latitude: 37.7779, longitude: -122.4164 },
    ] as RouteWaypoint[],
  },
} as const;

export type PresetRouteName = keyof typeof PRESET_ROUTES;

/**
 * Get a preset route by name
 */
export function getPresetRoute(name: PresetRouteName): RouteWaypoint[] {
  return PRESET_ROUTES[name]?.waypoints || [];
}

/**
 * Get all preset route names and descriptions
 */
export function getPresetRouteList(): Array<{ name: PresetRouteName; description: string }> {
  return Object.entries(PRESET_ROUTES).map(([key, route]) => ({
    name: key as PresetRouteName,
    description: `${route.name}: ${route.description}`,
  }));
}
