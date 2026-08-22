import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { buildTrailLineString } from '@/lib/tracking/trail-geojson';

interface ShiftRow {
  id: string;
  driver_id: string;
  shift_start: Date;
  shift_end: Date | null;
}

interface LocationRow {
  longitude: number;
  latitude: number;
  recorded_at: Date;
}

/**
 * GET /api/tracking/shifts/[id]/trail
 *
 * Admin-only: the travelled trail of a shift as a GeoJSON LineString Feature
 * built from the driver's `driver_locations` rows inside the shift window.
 * The live map fetches this once per on-duty driver and appends realtime
 * pings client-side.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });
    if (!authResult.success) {
      return authResult.response;
    }

    const shifts = await prisma.$queryRawUnsafe<ShiftRow[]>(
      `
        SELECT id, driver_id, shift_start, shift_end
        FROM driver_shifts
        WHERE id = $1::uuid
          AND deleted_at IS NULL
        LIMIT 1
      `,
      id,
    );
    const shift = shifts[0];
    if (!shift) {
      return NextResponse.json({ success: false, error: 'Shift not found' }, { status: 404 });
    }

    const locations = await prisma.$queryRawUnsafe<LocationRow[]>(
      `
        SELECT longitude, latitude, recorded_at
        FROM driver_locations
        WHERE driver_id = $1::uuid
          AND deleted_at IS NULL
          AND recorded_at >= $2::timestamptz
          AND ($3::timestamptz IS NULL OR recorded_at <= $3::timestamptz)
        ORDER BY recorded_at ASC
      `,
      shift.driver_id,
      shift.shift_start,
      shift.shift_end,
    );

    const trail = buildTrailLineString(
      locations.map((row) => ({
        longitude: Number(row.longitude),
        latitude: Number(row.latitude),
        recordedAt: row.recorded_at,
      })),
    );

    return NextResponse.json({
      success: true,
      data: {
        shiftId: shift.id,
        driverId: shift.driver_id,
        trail,
        pointCount: trail.properties.pointCount,
      },
    });
  } catch (error) {
    console.error('Error fetching shift trail:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch shift trail',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
