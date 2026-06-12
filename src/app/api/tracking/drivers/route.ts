import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { driverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { rawQuery } from '@/lib/db/raw';

interface Driver {
  id: string;
  user_id?: string;
  profile_id?: string;
  employee_id?: string;
  vehicle_number?: string;
  phone_number?: string;
  is_active: boolean;
  is_on_duty: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  current_shift_id?: string;
  last_known_location?: {
    type: string;
    coordinates: [number, number];
  };
  last_location_update?: string;
  last_known_accuracy?: number;
  last_known_speed?: number;
  last_known_heading?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
}

/** True when a raw-query error is a Postgres unique-violation (SQLSTATE 23505). */
function isUniqueViolation(error: any): boolean {
  return (
    error?.code === '23505' ||
    error?.meta?.code === '23505' ||
    String(error?.message ?? '').includes('23505')
  );
}

// GET - List drivers (admins) / own record (drivers)
export async function GET(request: NextRequest) {
  // AuthZ: drivers see only themselves; admins/helpdesk see all.
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active');
    const isOnDuty = searchParams.get('on_duty');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT
        id,
        user_id,
        profile_id,
        employee_id,
        vehicle_number,
        phone_number,
        is_active,
        is_on_duty,
        shift_start_time,
        shift_end_time,
        current_shift_id,
        ST_AsGeoJSON(last_known_location) as location_geojson,
        last_location_update,
        last_known_accuracy,
        last_known_speed,
        last_known_heading,
        created_at,
        updated_at
      FROM drivers
      WHERE deleted_at IS NULL
    `;

    const params: (string | number | boolean)[] = [];
    let paramCounter = 1;

    // Drivers are scoped to their own record (drivers.user_id === auth user id).
    if (auth.context.user.type === 'DRIVER') {
      query += ` AND user_id = $${paramCounter}`;
      params.push(auth.context.user.id);
      paramCounter++;
    }

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

    const rows = await rawQuery<any>(query, params);

    const drivers = rows.map((row: any) => ({
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

// POST - Create new driver (admins only)
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, {
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      user_id,
      profile_id,
      employee_id,
      vehicle_number,
      phone_number,
    } = body;

    // Validate - at least one identifier is needed
    if (!employee_id && !profile_id && !user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: at least one of employee_id, profile_id, or user_id is required'
        },
        { status: 400 }
      );
    }

    // profile_id and user_id both link a drivers row to the auth user and
    // share one id space (profiles.id === auth.users.id). profile_id is
    // canonical; user_id is the legacy duplicate (FK -> auth.users). Accept
    // either on input but store them in sync so ownership checks
    // (src/lib/auth/driver-ownership.ts) never see a divergent pair. The
    // user_id subselect nulls itself out when no auth.users row exists
    // (e.g. seeded profiles), since its FK would reject the insert.
    const authLinkId = profile_id || user_id || null;

    const rows = await rawQuery<any>(
      `
      INSERT INTO drivers (
        user_id,
        profile_id,
        employee_id,
        vehicle_number,
        phone_number
      )
      VALUES ((SELECT id FROM auth.users WHERE id = $1::uuid), $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        profile_id,
        employee_id,
        vehicle_number,
        phone_number,
        is_active,
        is_on_duty,
        created_at,
        updated_at
      `,
      [
        authLinkId, // user_id (guarded by the auth.users subselect)
        authLinkId, // profile_id
        employee_id || null,
        vehicle_number || null,
        phone_number || null,
      ],
    );

    return NextResponse.json({
      success: true,
      data: rows[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating driver:', error);

    // Handle unique constraint violation
    if (isUniqueViolation(error)) {
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
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT - Update driver location / duty (drivers: own record only)
export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, {
    allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { driver_id, location, is_on_duty } = body;

    if (!driver_id) {
      return NextResponse.json(
        { success: false, error: 'Missing driver_id' },
        { status: 400 }
      );
    }

    // A DRIVER may only update their own record.
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

    let query = 'UPDATE drivers SET last_location_update = NOW()';
    const params: (string | number | boolean)[] = [];
    let paramCounter = 1;

    if (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      location.longitude >= -180 &&
      location.longitude <= 180
    ) {
      query += `, last_known_location = ST_SetSRID(ST_MakePoint($${paramCounter}, $${paramCounter + 1}), 4326)::geography`;
      params.push(location.longitude, location.latitude);
      paramCounter += 2;
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

    const rows = await rawQuery<any>(query, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver not found' },
        { status: 404 }
      );
    }

    const driver = {
      ...rows[0],
      last_known_location: rows[0].location_geojson ?
        JSON.parse(rows[0].location_geojson) : null,
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

// DELETE - Delete driver (admins only)
export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, {
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

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

    const rows = await rawQuery<{ id: string }>(
      'DELETE FROM drivers WHERE id = $1 RETURNING id',
      [driverId],
    );

    if (rows.length === 0) {
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
