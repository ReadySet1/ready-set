import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { getDriverForUser } from '@/lib/auth/driver-ownership';
import { startDriverShift } from '@/app/actions/tracking/driver-actions';

interface ShiftListRow {
  id: string;
  driver_id: string;
  shift_start: Date;
  shift_end: Date | null;
  start_location_geojson: string | null;
  end_location_geojson: string | null;
  total_distance: number | null;
  total_distance_miles: number | null;
  gps_distance_miles: number | null;
  mileage_source: string | null;
  delivery_count: number | null;
  status: string;
  notes: string | null;
  break_start: Date | null;
  break_end: Date | null;
  created_at: Date;
  updated_at: Date;
  employee_id: string | null;
  vehicle_number: string | null;
}

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

    // Columns follow the shipped driver_shifts schema (see the note in
    // ./[id]/route.ts): shift_start / shift_end, total_distance (legacy km),
    // *_miles, mileage_source, notes, inline break_start / break_end. There is
    // no metadata column and no shift_breaks table.
    let query = `
      SELECT
        ds.id,
        ds.driver_id,
        ds.shift_start,
        ds.shift_end,
        ST_AsGeoJSON(ds.start_location) as start_location_geojson,
        ST_AsGeoJSON(ds.end_location) as end_location_geojson,
        ds.total_distance,
        ds.total_distance_miles,
        ds.gps_distance_miles,
        ds.mileage_source,
        ds.delivery_count,
        ds.status,
        ds.notes,
        ds.break_start,
        ds.break_end,
        ds.created_at,
        ds.updated_at,
        d.employee_id,
        d.vehicle_number
      FROM driver_shifts ds
      LEFT JOIN drivers d ON ds.driver_id = d.id
      WHERE ds.deleted_at IS NULL
    `;

    const params: any[] = [];
    let paramCounter = 1;

    // If user is DRIVER, only show their own shifts
    if (authResult.context.user.type === 'DRIVER') {
      const ownDriver = await getDriverForUser(authResult.context.user.id);
      if (!ownDriver) {
        // No driver row for this user — they have no shifts.
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { limit, offset, total: 0 }
        });
      }
      query += ` AND ds.driver_id = $${paramCounter}`;
      params.push(ownDriver.id);
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

    query += ` ORDER BY ds.shift_start DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const result = await prisma.$queryRawUnsafe<ShiftListRow[]>(query, ...params);

    const shifts = result.map((shift) => ({
      id: shift.id,
      driverId: shift.driver_id,
      startTime: shift.shift_start,
      endTime: shift.shift_end,
      startLocation: shift.start_location_geojson ?
        JSON.parse(shift.start_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      endLocation: shift.end_location_geojson ?
        JSON.parse(shift.end_location_geojson).coordinates.reverse() : undefined,
      totalDistanceMiles: shift.total_distance_miles,
      gpsDistanceMiles: shift.gps_distance_miles,
      mileageSource: shift.mileage_source,
      totalDistanceKm: shift.total_distance,
      deliveryCount: shift.delivery_count,
      status: shift.status,
      notes: shift.notes,
      // Single inline break per shift (break_start/break_end on the row).
      breaks: shift.break_start
        ? [{ startTime: shift.break_start, endTime: shift.break_end }]
        : [],
      createdAt: shift.created_at,
      updatedAt: shift.updated_at,
      // Additional driver info for admin views
      driverInfo: authResult.context.user.type !== 'DRIVER' ? {
        employeeId: shift.employee_id,
        vehicleNumber: shift.vehicle_number
      } : undefined
    }));

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
    const driver = await getDriverForUser(authResult.context.user.id);

    if (!driver || !driver.isActive) {
      return NextResponse.json(
        { success: false, error: 'Driver profile not found or inactive' },
        { status: 404 }
      );
    }

    // Check if driver already has an active shift
    if (driver.currentShiftId) {
      return NextResponse.json(
        { success: false, error: 'Driver already has an active shift' },
        { status: 409 }
      );
    }

    // Delegate the insert (and the driver on-duty update) to startDriverShift,
    // which targets the real schema and re-checks caller authorization.
    const started = await startDriverShift(
      driver.id,
      location,
      { vehicleCheck, ...metadata }
    );

    if (!started.success || !started.shiftId) {
      if (started.error === 'Access denied') {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
      // Never echo the underlying error to the client.
      console.error('Error starting shift:', started.error);
      return NextResponse.json(
        { success: false, error: 'Failed to start shift' },
        { status: 500 }
      );
    }

    // startDriverShift resumes an already-open shift instead of creating one.
    const resumed = started.resumed === true;

    return NextResponse.json({
      success: true,
      data: {
        shiftId: started.shiftId,
        startTime: new Date().toISOString(),
        status: 'active',
        ...(resumed ? { resumed: true } : {})
      }
    }, { status: resumed ? 200 : 201 });

  } catch (error) {
    console.error('Error starting shift:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start shift' },
      { status: 500 }
    );
  }
}