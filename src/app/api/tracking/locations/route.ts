import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { driverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { rawQuery, withRawTx, DbHttpError } from '@/lib/db/raw';
import { enforceRateLimit } from '@/lib/security/rate-limit';

interface LocationUpdate {
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  battery_level?: number;
  is_moving?: boolean;
  activity_type?: 'walking' | 'driving' | 'stationary';
}

// POST - Record driver location
export async function POST(request: NextRequest) {
  // AuthZ: only authenticated drivers/admins may write locations.
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  // Abuse protection: cap location writes per authenticated user (keyed by the
  // auth id, not the body driver_id, so it can't be bypassed). Multi-instance
  // safe via Upstash; falls open if the limiter backend is unavailable. Normal
  // drivers write ~12/min (client throttled to 1/5s) — well under the cap.
  const limited = await enforceRateLimit(auth.context.user.id, 'tracking-location-write');
  if (limited) return limited;

  try {
    const body = await request.json();
    const {
      driver_id,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      altitude,
      battery_level,
      is_moving,
      activity_type
    }: LocationUpdate = body;

    // Validate required fields
    if (!driver_id || typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: driver_id, latitude, longitude'
        },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    const isDriver = auth.context.user.type === 'DRIVER';

    // One transaction: ownership/existence check + insert + denormalized update.
    // A DRIVER may only write their OWN location (drivers row linked to the
    // auth user via profile_id or legacy user_id); admins may write for any
    // driver. Coordinates are bound as numeric params via ST_MakePoint (never
    // string-interpolated).
    const locationRow = await withRawTx(async (tx) => {
      const driverCheck = isDriver
        ? await tx.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM drivers WHERE id = $1 AND ${driverOwnershipCondition(2)} AND is_active = true`,
            driver_id,
            auth.context.user.id,
          )
        : await tx.$queryRawUnsafe<{ id: string }[]>(
            'SELECT id FROM drivers WHERE id = $1 AND is_active = true',
            driver_id,
          );

      if (driverCheck.length === 0) {
        throw new DbHttpError(isDriver ? 403 : 404, {
          success: false,
          error: isDriver ? 'Access denied' : 'Driver not found or inactive',
        });
      }

      const inserted = await tx.$queryRawUnsafe<any[]>(
        `
        INSERT INTO driver_locations (
          driver_id,
          location,
          accuracy,
          speed,
          heading,
          altitude,
          battery_level,
          is_moving,
          activity_type,
          recorded_at
        )
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING
          id,
          ST_AsGeoJSON(location) as location_geojson,
          accuracy,
          speed,
          heading,
          altitude,
          battery_level,
          is_moving,
          activity_type,
          recorded_at,
          created_at
        `,
        driver_id,
        longitude,
        latitude,
        accuracy ?? null,
        speed ?? null,
        heading ?? null,
        altitude ?? null,
        battery_level ?? null,
        is_moving ?? null,
        activity_type ?? null,
      );

      // Update driver's last known location
      await tx.$executeRawUnsafe(
        `
        UPDATE drivers
        SET
          last_known_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          last_location_update = NOW(),
          updated_at = NOW()
        WHERE id = $3
        `,
        longitude,
        latitude,
        driver_id,
      );

      return inserted[0];
    });

    const locationData = {
      ...locationRow,
      location: JSON.parse(locationRow.location_geojson)
    };

    return NextResponse.json({
      success: true,
      data: locationData
    }, { status: 201 });

  } catch (error) {
    if (error instanceof DbHttpError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('Error recording location:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - Get location history for a driver
export async function GET(request: NextRequest) {
  // AuthZ: drivers/admins only.
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const driver_id = searchParams.get('driver_id');
    // Clamp to sane bounds (also keeps the interpolated INTERVAL numeric).
    const hours = Math.min(Math.max(parseInt(searchParams.get('hours') || '24', 10) || 24, 1), 168);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 1000);

    if (!driver_id) {
      return NextResponse.json(
        { success: false, error: 'Missing driver_id parameter' },
        { status: 400 }
      );
    }

    // A DRIVER may only read their own location history.
    if (auth.context.user.type === 'DRIVER') {
      const owns = await rawQuery<{ id: string }>(
        `SELECT id FROM drivers WHERE id = $1 AND ${driverOwnershipCondition(2)}`,
        [driver_id, auth.context.user.id],
      );
      if (owns.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const rows = await rawQuery<any>(
      `
      SELECT
        id,
        ST_AsGeoJSON(location) as location_geojson,
        accuracy,
        speed,
        heading,
        altitude,
        battery_level,
        is_moving,
        activity_type,
        recorded_at,
        created_at
      FROM driver_locations
      WHERE
        driver_id = $1
        AND recorded_at >= NOW() - INTERVAL '${hours} hours'
      ORDER BY recorded_at DESC
      LIMIT $2
      `,
      [driver_id, limit],
    );

    const locations = rows.map((row: any) => ({
      ...row,
      location: JSON.parse(row.location_geojson)
    }));

    return NextResponse.json({
      success: true,
      data: locations,
      metadata: {
        driver_id,
        hours_requested: hours,
        total_points: locations.length
      }
    });

  } catch (error) {
    console.error('Error fetching location history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch location history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
