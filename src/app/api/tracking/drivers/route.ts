import { NextRequest, NextResponse } from 'next/server';
// import { Pool } from 'pg';
const Pool = require('pg').Pool;

// Database connection for tracking system
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface Driver {
  id: string;
  employee_id: string;
  vehicle_number: string;
  license_number: string;
  phone_number: string;
  is_active: boolean;
  is_on_duty: boolean;
  last_known_location?: {
    type: string;
    coordinates: [number, number];
  };
  last_location_update?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
}

// GET - List all drivers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active');
    const isOnDuty = searchParams.get('on_duty');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT 
        id,
        employee_id,
        vehicle_number,
        license_number,
        phone_number,
        is_active,
        is_on_duty,
        ST_AsGeoJSON(last_known_location) as location_geojson,
        last_location_update,
        metadata,
        created_at,
        updated_at
      FROM drivers
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCounter = 1;

    if (isActive !== null) {
      query += ` AND is_active = $${paramCounter}`;
      params.push(isActive === 'true');
      paramCounter++;
    }

    if (isOnDuty !== null) {
      query += ` AND is_on_duty = $${paramCounter}`;
      params.push(isOnDuty === 'true');
      paramCounter++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    const drivers = result.rows.map((row: any) => ({
      ...row,
      last_known_location: row.location_geojson ? JSON.parse(row.location_geojson) : null,
    }));

    return NextResponse.json({
      success: true,
      data: drivers,
      pagination: {
        limit,
        offset,
        total: drivers.length
      }
    });

  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch drivers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Create new driver
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      vehicle_number,
      license_number,
      phone_number,
      metadata = {}
    } = body;

    // Validate required fields
    if (!employee_id || !phone_number) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: employee_id, phone_number' 
        },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO drivers (
        employee_id, 
        vehicle_number, 
        license_number, 
        phone_number, 
        metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        employee_id,
        vehicle_number,
        license_number,
        phone_number,
        is_active,
        is_on_duty,
        metadata,
        created_at,
        updated_at
    `;

    const result = await pool.query(query, [
      employee_id,
      vehicle_number,
      license_number,
      phone_number,
      JSON.stringify(metadata)
    ]);

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating driver:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Driver with this employee_id already exists' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create driver',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// PUT - Update driver location
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { driver_id, location, is_on_duty } = body;

    if (!driver_id) {
      return NextResponse.json(
        { success: false, error: 'Missing driver_id' },
        { status: 400 }
      );
    }

    let query = 'UPDATE drivers SET last_location_update = NOW()';
    const params: any[] = [];
    let paramCounter = 1;

    if (location && location.latitude && location.longitude) {
      query += `, last_known_location = ST_GeogFromText($${paramCounter})`;
      params.push(`POINT(${location.longitude} ${location.latitude})`);
      paramCounter++;
    }

    if (typeof is_on_duty === 'boolean') {
      query += `, is_on_duty = $${paramCounter}`;
      params.push(is_on_duty);
      paramCounter++;
    }

    query += ` WHERE id = $${paramCounter} RETURNING 
      id,
      employee_id,
      is_active,
      is_on_duty,
      ST_AsGeoJSON(last_known_location) as location_geojson,
      last_location_update
    `;
    params.push(driver_id);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    const driver = {
      ...result.rows[0],
      last_known_location: result.rows[0].location_geojson ? 
        JSON.parse(result.rows[0].location_geojson) : null,
    };

    return NextResponse.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error('Error updating driver:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update driver',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete driver
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const driverId = pathParts[pathParts.length - 1];

    if (!driverId || driverId === 'route') {
      return NextResponse.json(
        { success: false, error: 'Driver ID is required' },
        { status: 400 }
      );
    }

    const query = 'DELETE FROM drivers WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [driverId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: driverId, deleted: true }
    });

  } catch (error) {
    console.error('Error deleting driver:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete driver',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 