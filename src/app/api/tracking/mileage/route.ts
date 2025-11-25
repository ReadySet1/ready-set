import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import {
  calculateShiftMileage,
  calculateShiftMileageWithBreakdown,
} from '@/services/tracking/mileage';

const MileageQuerySchema = z.object({
  driverId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(['json', 'csv']).optional(),
});

type MileageQuery = z.infer<typeof MileageQuerySchema>;

function parseQuery(request: NextRequest): MileageQuery {
  const { searchParams } = new URL(request.url);

  const raw = {
    driverId: searchParams.get('driverId') ?? undefined,
    shiftId: searchParams.get('shiftId') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    format: (searchParams.get('format') as 'json' | 'csv' | null) ?? undefined,
  };

  const result = MileageQuerySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid query parameters: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }

  return result.data;
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return 'driver_id,shift_id,shift_start,shift_end,total_distance_km,delivery_count\n';
  }

  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(key => escape(row[key])).join(',')),
  ];

  return lines.join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const query = parseQuery(request);
    const format = query.format ?? 'json';

    // If a specific shiftId is provided, return detailed mileage for that shift,
    // including per-delivery breakdown.
    if (query.shiftId) {
      const mileage = await calculateShiftMileageWithBreakdown(query.shiftId);

      if (format === 'csv') {
        const csvRows = mileage.deliveries.map(delivery => ({
          shift_id: query.shiftId!,
          delivery_id: delivery.deliveryId,
          distance_km: delivery.distanceKm,
        }));

        const csv = buildCsv(csvRows);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="shift-${query.shiftId}-mileage.csv"`,
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            shiftId: query.shiftId,
            totalKm: mileage.totalKm,
            deliveries: mileage.deliveries,
          },
        },
        { status: 200 }
      );
    }

    // Aggregate mileage grouped by shift within the given time range.
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days

    const params: any[] = [startDate, endDate];
    let paramIndex = 3;

    let sql = `
      SELECT
        ds.id AS shift_id,
        ds.driver_id,
        ds.shift_start,
        ds.shift_end,
        ds.total_distance_km,
        ds.delivery_count
      FROM driver_shifts ds
      WHERE
        ds.shift_start >= $1::timestamptz
        AND ds.shift_start <= $2::timestamptz
        AND ds.deleted_at IS NULL
    `;

    if (query.driverId) {
      sql += ` AND ds.driver_id = $${paramIndex}::uuid`;
      params.push(query.driverId);
      paramIndex += 1;
    }

    sql += ' ORDER BY ds.shift_start DESC';

    const rows = await prisma.$queryRawUnsafe<{
      shift_id: string;
      driver_id: string;
      shift_start: Date;
      shift_end: Date | null;
      total_distance_km: number | null;
      delivery_count: number | null;
    }[]>(sql, ...params);

    if (format === 'csv') {
      const csvRows = rows.map(row => ({
        driver_id: row.driver_id,
        shift_id: row.shift_id,
        shift_start: row.shift_start.toISOString(),
        shift_end: row.shift_end ? row.shift_end.toISOString() : '',
        total_distance_km: row.total_distance_km ?? 0,
        delivery_count: row.delivery_count ?? 0,
      }));

      const csv = buildCsv(csvRows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="mileage-report.csv"',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: rows.map(row => ({
          driverId: row.driver_id,
          shiftId: row.shift_id,
          shiftStart: row.shift_start,
          shiftEnd: row.shift_end,
          totalDistanceKm: row.total_distance_km ?? 0,
          deliveryCount: row.delivery_count ?? 0,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching mileage report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch mileage report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


