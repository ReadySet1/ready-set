import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';

// GET - Get specific shift details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

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
      WHERE ds.id = $1
    `;

    const params_array = [id];

    // If user is DRIVER, verify they own this shift
    if (authResult.context.user.type === 'DRIVER') {
      query += ` AND ds.driver_id = (SELECT id FROM drivers WHERE user_id = $2)`;
      params_array.push(authResult.context.user.id);
    }

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params_array);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      );
    }

    const shift = result[0];

    // Get breaks for this shift
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

    const shiftData = {
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

    return NextResponse.json({
      success: true,
      data: shiftData
    });

  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch shift',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT - Update shift (end shift, update metadata)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const { action, location, metadata = {} } = body;

    // Verify shift exists and user has permission
    let verifyQuery = `
      SELECT ds.driver_id, ds.status, d.user_id
      FROM driver_shifts ds
      LEFT JOIN drivers d ON ds.driver_id = d.id
      WHERE ds.id = $1
    `;

    const verifyResult = await prisma.$queryRawUnsafe<{
      driver_id: string;
      status: string;
      user_id?: string;
    }[]>(verifyQuery, id);

    if (verifyResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      );
    }

    const shift = verifyResult[0];

    // If user is DRIVER, verify they own this shift
    if (authResult.context.user.type === 'DRIVER' && shift?.user_id !== authResult.context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'end':
        if (shift?.status !== 'active' && shift?.status !== 'paused') {
          return NextResponse.json(
            { success: false, error: 'Shift is not active' },
            { status: 400 }
          );
        }

        // End shift: record end location and mark as completed. Detailed mileage
        // calculation is now handled by the mileage service and driver actions.
        await prisma.$executeRawUnsafe(`
          UPDATE driver_shifts 
          SET 
            end_time = NOW(),
            end_location = ${location ? 'ST_GeogFromText($2)' : 'NULL'},
            status = 'completed',
            metadata = metadata || $4::jsonb,
            updated_at = NOW()
          WHERE id = $1::uuid
        `,
          id,
          location ? `POINT(${location.coordinates.lng} ${location.coordinates.lat})` : null,
          JSON.stringify(metadata)
        );

        // Update driver status
        await prisma.$executeRawUnsafe(`
          UPDATE drivers 
          SET 
            is_on_duty = false,
            current_shift_id = NULL,
            shift_start_time = NULL,
            ${location ? 'last_known_location = ST_GeogFromText($2),' : ''}
            last_location_update = NOW(),
            updated_at = NOW()
          WHERE id = $1::uuid
        `,
          shift.driver_id,
          location ? `POINT(${location.coordinates.lng} ${location.coordinates.lat})` : null
        );

        break;

      case 'update_metadata':
        await prisma.$executeRawUnsafe(`
          UPDATE driver_shifts 
          SET 
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
          WHERE id = $1::uuid
        `, id, JSON.stringify(metadata));
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Shift ${action} completed successfully`
    });

  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update shift',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}