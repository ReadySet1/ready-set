/**
 * RouteOptimizer component-level types.
 * Re-exports from @/types/routing plus UI-specific state types.
 */

export type {
  LatLng,
  Waypoint,
  RouteRequest,
  RouteResult,
  RouteLeg,
  RouteStep,
  RouteApiResponse,
} from '@/types/routing';

export interface RouteFormValues {
  pickupAddress: string;
  dropoffAddress: string;
  waypoints: string[];
  optimizeWaypoints: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
}

export type RouteStatus = 'idle' | 'loading' | 'success' | 'error';
