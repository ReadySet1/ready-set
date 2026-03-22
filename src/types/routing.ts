import { z } from 'zod';

export type { LatLng, RouteResult } from '@/services/routing/google-directions';

const RouteWaypointSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  placeId: z.string().optional(),
});

export const RouteRequestSchema = z.object({
  pickup: RouteWaypointSchema,
  dropoff: RouteWaypointSchema,
  waypoints: z.array(RouteWaypointSchema).optional(),
  optimizeWaypoints: z.boolean().optional(),
  avoidTolls: z.boolean().optional(),
  avoidHighways: z.boolean().optional(),
  departureTime: z.union([z.string(), z.literal('now')]).optional(),
});

export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export interface RouteApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
