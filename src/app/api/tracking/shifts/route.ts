import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import type { DriverShift } from '@/types/tracking';

// GET - Get shifts for a driver or all active shifts (admin)
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driver_id');
    const status = searchParams.get('status'); // active, paused, completed
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = `
      SELECT 
        ds.id,
        ds.driver_id,
        ds.start_time,
        ds.end_time,
        ST_AsGeoJSON(ds.start_location) as start_location_geojson,
        ST_AsGeoJSON(ds.end_location) as end_location_geojson,
        ds.total_distance_km,
        ds.delivery_count,
        ds.status,
        ds.metadata,
        ds.created_at,
        ds.updated_at,
        d.employee_id,
        d.vehicle_number
      FROM driver_shifts ds
      LEFT JOIN drivers d ON ds.driver_id = d.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCounter = 1;

    // If user is DRIVER, only show their own shifts
    if (authResult.context.user.type === 'DRIVER') {
      // Assume driver has a profile linking to the drivers table
      query += ` AND ds.driver_id = (SELECT id FROM drivers WHERE user_id = $${paramCounter})`;
      params.push(authResult.context.user.id);
      paramCounter++;
    } else if (driverId) {
      query += ` AND ds.driver_id = $${paramCounter}`;
      params.push(driverId);
      paramCounter++;
    }

    if (status) {
      query += ` AND ds.status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    query += ` ORDER BY ds.start_time DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    // Get breaks for each shift
    const shifts = await Promise.all(
      result.map(async (shift) => {
        const breaks = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            id,
            shift_id,
            start_time,
            end_time,
            break_type,
            ST_AsGeoJSON(location) as location_geojson,
            created_at
          FROM shift_breaks
          WHERE shift_id = $1
          ORDER BY start_time DESC
        `, shift.id);

        return {
          id: shift.id,
          driverId: shift.driver_id,
          startTime: shift.start_time,
          endTime: shift.end_time,
          startLocation: shift.start_location_geojson ? 
            JSON.parse(shift.start_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
          endLocation: shift.end_location_geojson ? 
            JSON.parse(shift.end_location_geojson).coordinates.reverse() : undefined,
          totalDistanceKm: shift.total_distance_km,
          deliveryCount: shift.delivery_count,
          status: shift.status,
          breaks: breaks.map(b => ({
            id: b.id,
            shiftId: b.shift_id,
            startTime: b.start_time,
            endTime: b.end_time,
            breakType: b.break_type,
            location: b.location_geojson ? 
              JSON.parse(b.location_geojson).coordinates.reverse() : undefined,
            createdAt: b.created_at
          })),
          metadata: shift.metadata,
          createdAt: shift.created_at,
          updatedAt: shift.updated_at,
          // Additional driver info for admin views
          driverInfo: authResult.context.user.type !== 'DRIVER' ? {
            employeeId: shift.employee_id,
            vehicleNumber: shift.vehicle_number
          } : undefined
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: shifts,
      pagination: {
        limit,
        offset,
        total: shifts.length
      }
    });

  } catch (error) {
    console.error('Error fetching shifts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch shifts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Start a new shift (drivers only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const { location, vehicleCheck = false, metadata = {} } = body;

    if (!location || !location.coordinates) {
      return NextResponse.json(
        { success: false, error: 'Location coordinates required' },
        { status: 400 }
      );
    }

    // Get driver ID from user profile
    const driverResult = await prisma.$queryRawUnsafe<{ id: string; current_shift_id?: string }[]>(`
      SELECT id, current_shift_id 
      FROM drivers 
      WHERE user_id = $1 AND is_active = true
    `, authResult.context.user.id);

    if (driverResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver profile not found or inactive' },
        { status: 404 }
      );
    }

    const driver = driverResult[0];

    // Check if driver already has an active shift
    if (driver?.current_shift_id) {
      return NextResponse.json(
        { success: false, error: 'Driver already has an active shift' },
        { status: 409 }
      );
    }

    // Create new shift
    const shiftResult = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      INSERT INTO driver_shifts (
        driver_id,
        start_time,
        start_location,
        status,
        metadata
      ) VALUES (
        $1::uuid,
        NOW(),
        ST_GeogFromText($2),
        'active',
        $3::jsonb
      ) RETURNING id
    `,
      driver?.id,
      `POINT(${location.coordinates.lng} ${location.coordinates.lat})`,
      JSON.stringify({ vehicleCheck, ...metadata })
    );

    const shiftId = shiftResult[0]?.id;
    if (!shiftId) {
      return NextResponse.json(
        { success: false, error: 'Failed to create shift' },
        { status: 500 }
      );
    }

    // Update driver status
    await prisma.$executeRawUnsafe(`
      UPDATE drivers 
      SET 
        is_on_duty = true,
        current_shift_id = $2::uuid,
        shift_start_time = NOW(),
        last_known_location = ST_GeogFromText($3),
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      driver?.id,
      shiftId,
      `POINT(${location.coordinates.lng} ${location.coordinates.lat})`
    );

    return NextResponse.json({
      success: true,
      data: {
        shiftId,
        startTime: new Date().toISOString(),
        status: 'active'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error starting shift:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start shift',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}