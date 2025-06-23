import { NextRequest, NextResponse } from 'next/server';
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

    // Check if driver exists
    const driverCheck = await client.query(
      'SELECT id FROM drivers WHERE id = $1 AND is_active = true',
      [driver_id]
    );

    if (driverCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'Driver not found or inactive' },
        { status: 404 }
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
      VALUES ($1, ST_GeogFromText($2), $3, $4, $5, $6, $7, $8, $9, NOW())
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
      `POINT(${longitude} ${latitude})`,
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
        last_known_location = ST_GeogFromText($1),
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `, [`POINT(${longitude} ${latitude})`, driver_id]);

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
  try {
    const { searchParams } = new URL(request.url);
    const driver_id = searchParams.get('driver_id');
    const hours = parseInt(searchParams.get('hours') || '24');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!driver_id) {
      return NextResponse.json(
        { success: false, error: 'Missing driver_id parameter' },
        { status: 400 }
      );
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