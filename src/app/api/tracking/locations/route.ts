import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
// import { Pool } from 'pg';
const Pool = require('pg').Pool;

// Database connection for tracking system
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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

    // Check if driver exists. A DRIVER may only write their OWN location:
    // verify the target driver row belongs to the authenticated user
    // (drivers.user_id === auth user id). Admins may write for any driver.
    const isDriver = auth.context.user.type === 'DRIVER';
    const driverCheck = isDriver
      ? await client.query(
          'SELECT id FROM drivers WHERE id = $1 AND user_id = $2 AND is_active = true',
          [driver_id, auth.context.user.id]
        )
      : await client.query(
          'SELECT id FROM drivers WHERE id = $1 AND is_active = true',
          [driver_id]
        );

    if (driverCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          success: false,
          error: isDriver
            ? 'Access denied'
            : 'Driver not found or inactive',
        },
        { status: isDriver ? 403 : 404 }
      );
    }

    // Insert location record
    const locationQuery = `
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
    `;

    const locationResult = await client.query(locationQuery, [
      driver_id,
      longitude,
      latitude,
      accuracy,
      speed,
      heading,
      altitude,
      battery_level,
      is_moving,
      activity_type
    ]);

    // Update driver's last known location
    await client.query(`
      UPDATE drivers
      SET
        last_known_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, [longitude, latitude, driver_id]);

    await client.query('COMMIT');

    const locationData = {
      ...locationResult.rows[0],
      location: JSON.parse(locationResult.rows[0].location_geojson)
    };

    return NextResponse.json({
      success: true,
      data: locationData
    }, { status: 201 });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording location:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to record location',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    client.release();
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
      const owns = await pool.query(
        'SELECT id FROM drivers WHERE id = $1 AND user_id = $2',
        [driver_id, auth.context.user.id]
      );
      if (owns.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    const query = `
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
    `;

    const result = await pool.query(query, [driver_id, limit]);

    const locations = result.rows.map((row: any) => ({
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