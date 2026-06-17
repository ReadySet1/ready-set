import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import type { PODGalleryItem } from '@/types/proof-of-delivery';

/**
 * GET /api/tracking/deliveries/pod-gallery
 *
 * Fetches paginated proof of delivery photos for the admin gallery.
 * Supports search, driver filtering, and date range filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '12');
    const search = searchParams.get('search') || '';
    const driverId = searchParams.get('driverId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build dynamic query with parameterized filters
    // NOTE: the `deliveries` table carries its own order_number/customer_name/
    // delivery_address and has NO catering_request_id/on_demand_id/proof_of_delivery/
    // completed_at columns — query its real columns directly (no order-table joins).
    let query = `
      SELECT
        d.id,
        d.id as delivery_id,
        COALESCE(d.order_number, d.id::text) as order_number,
        d.delivery_photo_url as photo_url,
        COALESCE(d.delivered_at, d.created_at) as captured_at,
        d.status,
        dr.id as driver_id,
        COALESCE(p.name, 'Unknown Driver') as driver_name,
        COALESCE(d.customer_name, '') as customer_name,
        COALESCE(d.delivery_address, '') as delivery_address
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      LEFT JOIN profiles p ON dr.profile_id = p.id
      WHERE d.deleted_at IS NULL
        AND d.delivery_photo_url IS NOT NULL
    `;

    const params: any[] = [];
    let paramCounter = 1;

    // Add driver filter
    if (driverId) {
      query += ` AND d.driver_id = $${paramCounter}::uuid`;
      params.push(driverId);
      paramCounter++;
    }

    // Add search filter (search across order number, driver name, customer name)
    if (search) {
      query += ` AND (
        COALESCE(d.order_number, '') ILIKE $${paramCounter}
        OR COALESCE(p.name, '') ILIKE $${paramCounter}
        OR COALESCE(d.customer_name, '') ILIKE $${paramCounter}
      )`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Add date range filters
    if (dateFrom) {
      query += ` AND COALESCE(d.delivered_at, d.created_at) >= $${paramCounter}::timestamptz`;
      params.push(dateFrom);
      paramCounter++;
    }

    if (dateTo) {
      query += ` AND COALESCE(d.delivered_at, d.created_at) <= $${paramCounter}::timestamptz`;
      params.push(dateTo);
      paramCounter++;
    }

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      LEFT JOIN profiles p ON dr.profile_id = p.id
      WHERE d.deleted_at IS NULL
        AND d.delivery_photo_url IS NOT NULL
        ${driverId ? `AND d.driver_id = $1::uuid` : ''}
        ${search ? `AND (
          COALESCE(d.order_number, '') ILIKE $${driverId ? 2 : 1}
          OR COALESCE(p.name, '') ILIKE $${driverId ? 2 : 1}
          OR COALESCE(d.customer_name, '') ILIKE $${driverId ? 2 : 1}
        )` : ''}
    `;

    // Build count params (subset of main query params)
    const countParams: any[] = [];
    if (driverId) countParams.push(driverId);
    if (search) countParams.push(`%${search}%`);

    // Add ordering and pagination to main query
    query += ` ORDER BY COALESCE(d.delivered_at, d.created_at) DESC NULLS LAST`;
    query += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(pageSize, offset);

    // Execute queries
    const [dataResult, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(query, ...params),
      prisma.$queryRawUnsafe<{ total: bigint }[]>(countQuery, ...countParams)
    ]);

    // Transform results to PODGalleryItem format
    const items: PODGalleryItem[] = dataResult.map(row => ({
      id: row.id,
      deliveryId: row.delivery_id,
      orderNumber: row.order_number || row.id,
      photoUrl: row.photo_url,
      capturedAt: new Date(row.captured_at),
      driverName: row.driver_name,
      driverId: row.driver_id,
      customerName: row.customer_name || undefined,
      deliveryAddress: row.delivery_address || undefined,
      deliveryStatus: row.status
    }));

    const totalItems = Number(countResult[0]?.total || 0);

    return NextResponse.json({
      items,
      totalItems
    });

  } catch (error) {
    console.error('Error fetching POD gallery:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch POD gallery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
