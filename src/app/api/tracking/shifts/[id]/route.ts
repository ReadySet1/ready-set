/**
 * GET/PUT /api/tracking/shifts/[id] — shift detail.
 *
 * Targets the shipped `driver_shifts` schema (prisma model `DriverShift`):
 * `shift_start` / `shift_end` (not start_time/end_time), `total_distance` (legacy
 * km), `total_distance_miles`, `gps_distance_miles`, `mileage_source`,
 * `delivery_count`, `status`, `notes`, `break_start` / `break_end`, `deleted_at`.
 * There is no `metadata` column and no `shift_breaks` table: a shift carries at
 * most one break, inline on the row.
 *
 * `PUT action=end` delegates to `endDriverShift`, which owns the active-delivery
 * guard, mileage computation and the driver's on-duty reset.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { userOwnsDriver } from '@/lib/auth/driver-ownership';
import { endDriverShift } from '@/app/actions/tracking/driver-actions';

interface ShiftDetailRow {
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

    const result = await prisma.$queryRawUnsafe<ShiftDetailRow[]>(`
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
      WHERE ds.id = $1::uuid
        AND ds.deleted_at IS NULL
    `, id);

    const shift = result[0];

    if (!shift) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      );
    }

    // If user is DRIVER, verify they own this shift. Report non-owned shifts
    // as 404 (not 403) so the route is not an existence oracle.
    if (authResult.context.user.type === 'DRIVER') {
      const owns = await userOwnsDriver(shift.driver_id, authResult.context.user.id);
      if (!owns) {
        return NextResponse.json(
          { success: false, error: 'Shift not found' },
          { status: 404 }
        );
      }
    }

    const shiftData = {
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
    const verifyResult = await prisma.$queryRawUnsafe<{
      driver_id: string;
      status: string;
    }[]>(`
      SELECT ds.driver_id, ds.status
      FROM driver_shifts ds
      WHERE ds.id = $1::uuid
        AND ds.deleted_at IS NULL
    `, id);

    const shift = verifyResult[0];

    if (!shift) {
      return NextResponse.json(
        { success: false, error: 'Shift not found' },
        { status: 404 }
      );
    }

    // If user is DRIVER, verify they own this shift
    if (authResult.context.user.type === 'DRIVER') {
      const owns = await userOwnsDriver(shift.driver_id, authResult.context.user.id);
      if (!owns) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    switch (action) {
      case 'end': {
        if (shift.status !== 'active' && shift.status !== 'paused') {
          return NextResponse.json(
            { success: false, error: 'Shift is not active' },
            { status: 400 }
          );
        }

        if (!location?.coordinates) {
          return NextResponse.json(
            { success: false, error: 'Missing location' },
            { status: 400 }
          );
        }

        // Same contract as POST /api/tracking/shifts/end: endDriverShift owns the
        // active-delivery guard, mileage, and the driver's on-duty reset.
        // 200 on success; 409 when the guard blocks; 400 otherwise.
        const result = await endDriverShift(id, location, body.finalMileage, metadata ?? {});
        const status = result.success ? 200 : result.activeDeliveries ? 409 : 400;
        return NextResponse.json(result, { status });
      }

      case 'update_metadata':
        // driver_shifts has no metadata column (and no jsonb anywhere on the
        // row). The only free-form field is `notes`, so the payload is appended
        // there as serialized JSON — same convention endDriverShift uses for
        // metadata.notes / client-reported mileage.
        await prisma.$executeRawUnsafe(`
          UPDATE driver_shifts
          SET
            notes = COALESCE(notes, '') || $2,
            updated_at = NOW()
          WHERE id = $1::uuid
            AND deleted_at IS NULL
        `, id, ' ' + JSON.stringify(metadata ?? {}));
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
