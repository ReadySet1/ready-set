/**
 * POST /api/routes/distance
 *
 * Calculates distance (in miles) and duration between multiple
 * origin/destination pairs using Google Distance Matrix API.
 *
 * Body: DistanceMatrixRequest (see @/types/routing)
 * Returns: RouteApiResponse<DistanceMatrixResult>
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { DistanceMatrixRequestSchema } from '@/types/routing';
import type {
  RouteApiResponse,
  DistanceMatrixResult,
  DistanceMatrixEntry,
} from '@/types/routing';
import { createClient } from '@/utils/supabase/server';

const GOOGLE_DISTANCE_MATRIX_URL =
  'https://maps.googleapis.com/maps/api/distancematrix/json';
const METERS_TO_MILES = 0.000621371;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<RouteApiResponse<DistanceMatrixResult>>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = DistanceMatrixRequestSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        { success: false, error: `Validation error: ${errors}`, timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Maps API key not configured', timestamp: new Date().toISOString() },
        { status: 500 },
      );
    }

    const { origins, destinations } = parsed.data;
    const originsStr = origins.map((o) => o.placeId ? `place_id:${o.placeId}` : o.address).join('|');
    const destsStr = destinations.map((d) => d.placeId ? `place_id:${d.placeId}` : d.address).join('|');

    const params = new URLSearchParams({
      origins: originsStr,
      destinations: destsStr,
      key: apiKey,
      units: 'imperial',
      mode: 'driving',
    });

    const response = await fetch(`${GOOGLE_DISTANCE_MATRIX_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`Google Distance Matrix API returned ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix error: ${data.status}`);
    }

    const entries: DistanceMatrixEntry[] = [];
    for (let i = 0; i < data.rows.length; i++) {
      for (let j = 0; j < data.rows[i].elements.length; j++) {
        const el = data.rows[i].elements[j];
        entries.push({
          originAddress: data.origin_addresses[i],
          destinationAddress: data.destination_addresses[j],
          distanceMiles:
            el.status === 'OK'
              ? Math.round(el.distance.value * METERS_TO_MILES * 100) / 100
              : 0,
          durationMinutes:
            el.status === 'OK'
              ? Math.round((el.duration.value / 60) * 10) / 10
              : 0,
          status: el.status,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        entries,
        originAddresses: data.origin_addresses,
        destinationAddresses: data.destination_addresses,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'route-distance-matrix' },
    });

    const message =
      error instanceof Error ? error.message : 'Failed to calculate distances';

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
