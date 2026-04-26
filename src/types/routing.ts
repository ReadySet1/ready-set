/**
 * Shared routing types and Zod schemas used by API routes,
 * the RouteOptimizer UI, and the MileageCalculator.
 *
 * Canonical type definitions live here; service-level files
 * (e.g. google-directions.ts) re-export or extend as needed.
 */

import { z } from 'zod';

// ─── Core Geometry ──────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

// ─── Waypoint / Location ────────────────────────────────────────────────────

export interface Waypoint {
  address: string;
  placeId?: string;
}

// ─── Route Request / Response ───────────────────────────────────────────────

export interface RouteRequest {
  pickup: Waypoint;
  dropoff: Waypoint;
  waypoints?: Waypoint[];
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

// ─── Distance Matrix ────────────────────────────────────────────────────────

export interface DistanceMatrixEntry {
  originAddress: string;
  destinationAddress: string;
  distanceMiles: number;
  durationMinutes: number;
  status: string;
}

export interface DistanceMatrixResult {
  entries: DistanceMatrixEntry[];
  originAddresses: string[];
  destinationAddresses: string[];
}

// ─── Generic API Response Wrapper ───────────────────────────────────────────

export interface RouteApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const WaypointSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  placeId: z.string().optional(),
});

export const RouteRequestSchema = z.object({
  pickup: WaypointSchema,
  dropoff: WaypointSchema,
  waypoints: z.array(WaypointSchema).optional(),
  optimizeWaypoints: z.boolean().optional(),
  avoidTolls: z.boolean().optional(),
  avoidHighways: z.boolean().optional(),
  departureTime: z.union([z.string(), z.literal('now')]).optional(),
  preferMedianRoute: z.boolean().optional(),
});

export const DistanceMatrixRequestSchema = z.object({
  origins: z.array(WaypointSchema).min(1, 'At least one origin is required'),
  destinations: z.array(WaypointSchema).min(1, 'At least one destination is required'),
});

export type DistanceMatrixRequest = z.infer<typeof DistanceMatrixRequestSchema>;
