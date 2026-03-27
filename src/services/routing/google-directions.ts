/**
 * Google Directions API Service
 *
 * Server-side only — keeps the API key secret.
 * Wraps the Google Maps Directions API and returns typed RouteResult objects.
 */

const GOOGLE_DIRECTIONS_URL =
  'https://maps.googleapis.com/maps/api/directions/json';
const GOOGLE_DISTANCE_MATRIX_URL =
  'https://maps.googleapis.com/maps/api/distancematrix/json';

const METERS_TO_MILES = 0.000621371;

function getApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY is not configured. Add it to your .env.local file.',
    );
  }
  return key;
}

// ─── Public types ────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

interface RouteWaypoint {
  address: string;
  placeId?: string;
}

export interface RouteRequest {
  pickup: RouteWaypoint;
  dropoff: RouteWaypoint;
  waypoints?: RouteWaypoint[];
  optimizeWaypoints?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  departureTime?: string | 'now';
  /** When true, requests alternative routes and selects the median by distance. */
  preferMedianRoute?: boolean;
}

export interface RouteStep {
  instruction: string;
  distanceMiles: number;
  durationMinutes: number;
  startLocation: LatLng;
  endLocation: LatLng;
}

export interface RouteLeg {
  startAddress: string;
  endAddress: string;
  distanceMiles: number;
  durationMinutes: number;
  steps: RouteStep[];
}

export interface RouteResult {
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  legs: RouteLeg[];
  polyline: string;
  waypointOrder?: number[];
  bounds: { northeast: LatLng; southwest: LatLng };
  warnings: string[];
  copyrights: string;
}

// ─── Types for Google's raw API response ────────────────────────────────────

interface GoogleLatLng {
  lat: number;
  lng: number;
}

interface GoogleStep {
  html_instructions: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  start_location: GoogleLatLng;
  end_location: GoogleLatLng;
}

interface GoogleLeg {
  start_address: string;
  end_address: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  steps: GoogleStep[];
}

interface GoogleRoute {
  legs: GoogleLeg[];
  overview_polyline: { points: string };
  waypoint_order: number[];
  bounds: {
    northeast: GoogleLatLng;
    southwest: GoogleLatLng;
  };
  warnings: string[];
  copyrights: string;
}

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes: GoogleRoute[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function metersToMiles(meters: number): number {
  return Math.round(meters * METERS_TO_MILES * 100) / 100;
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60 * 10) / 10;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function waypointToParam(wp: { address: string; placeId?: string }): string {
  if (wp.placeId) {
    return `place_id:${wp.placeId}`;
  }
  return wp.address;
}

// ─── Main Functions ─────────────────────────────────────────────────────────

/**
 * Fetch optimized route from Google Directions API.
 */
export async function getDirections(
  request: RouteRequest,
): Promise<RouteResult> {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    origin: waypointToParam(request.pickup),
    destination: waypointToParam(request.dropoff),
    key: apiKey,
    units: 'imperial',
    mode: 'driving',
  });

  // Optional waypoints
  if (request.waypoints && request.waypoints.length > 0) {
    const prefix = request.optimizeWaypoints ? 'optimize:true|' : '';
    const wpStr = request.waypoints.map(waypointToParam).join('|');
    params.set('waypoints', `${prefix}${wpStr}`);
  }

  // Route preferences
  const avoid: string[] = [];
  if (request.avoidTolls) avoid.push('tolls');
  if (request.avoidHighways) avoid.push('highways');
  if (avoid.length > 0) params.set('avoid', avoid.join('|'));

  // Departure time for traffic-aware routing
  if (request.departureTime) {
    const ts =
      request.departureTime === 'now'
        ? 'now'
        : String(Math.floor(new Date(request.departureTime).getTime() / 1000));
    params.set('departure_time', ts);
  }

  // Request alternative routes when median selection is enabled.
  // Google only returns alternatives for direct routes (no waypoints).
  const wantsMedian =
    request.preferMedianRoute &&
    (!request.waypoints || request.waypoints.length === 0);

  if (wantsMedian) {
    params.set('alternatives', 'true');
  }

  const url = `${GOOGLE_DIRECTIONS_URL}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Directions API returned ${response.status}`);
  }

  const data: GoogleDirectionsResponse = await response.json();

  if (data.status !== 'OK') {
    throw new Error(
      `Google Directions API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`,
    );
  }

  if (data.routes.length === 0) {
    throw new Error('No route found between the given locations');
  }

  const route = wantsMedian
    ? selectMedianRoute(data.routes)
    : data.routes[0]!;

  return mapGoogleRouteToResult(route);
}

/**
 * Given multiple route alternatives, sort by total distance and return
 * the median (middle) route. This avoids both the shortest shortcut
 * and the longest detour, giving a balanced "standard" route.
 *
 * - 1 route  → return it
 * - 2 routes → return the shorter one
 * - 3+ routes → sort by distance ascending, pick the middle index
 */
function selectMedianRoute(routes: GoogleRoute[]): GoogleRoute {
  if (routes.length <= 1) return routes[0]!;

  const scored = routes.map((route, originalIdx) => {
    const totalMeters = route.legs.reduce(
      (sum, leg) => sum + leg.distance.value,
      0,
    );
    return { route, totalMeters, originalIdx };
  });

  scored.sort((a, b) => a.totalMeters - b.totalMeters);

  const medianIdx = Math.floor((scored.length - 1) / 2);
  const selected = scored[medianIdx]!;

  return selected.route;
}

/**
 * Maps Google's raw route object to our typed RouteResult.
 */
function mapGoogleRouteToResult(route: GoogleRoute): RouteResult {
  const legs: RouteLeg[] = route.legs.map((leg) => ({
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    distanceMiles: metersToMiles(leg.distance.value),
    durationMinutes: secondsToMinutes(leg.duration.value),
    steps: leg.steps.map(
      (step): RouteStep => ({
        instruction: stripHtml(step.html_instructions),
        distanceMiles: metersToMiles(step.distance.value),
        durationMinutes: secondsToMinutes(step.duration.value),
        startLocation: step.start_location,
        endLocation: step.end_location,
      }),
    ),
  }));

  const totalDistanceMiles = legs.reduce(
    (sum, leg) => sum + leg.distanceMiles,
    0,
  );
  const totalDurationMinutes = legs.reduce(
    (sum, leg) => sum + leg.durationMinutes,
    0,
  );

  return {
    totalDistanceMiles: Math.round(totalDistanceMiles * 100) / 100,
    totalDurationMinutes: Math.round(totalDurationMinutes * 10) / 10,
    legs,
    polyline: route.overview_polyline.points,
    waypointOrder:
      route.waypoint_order.length > 0 ? route.waypoint_order : undefined,
    bounds: route.bounds,
    warnings: route.warnings,
    copyrights: route.copyrights,
  };
}
