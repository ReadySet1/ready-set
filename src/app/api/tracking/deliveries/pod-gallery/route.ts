import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import type { PODGalleryItem, PODGalleryPhoto } from '@/types/proof-of-delivery';
import { DELIVERY_PHOTO_CATEGORY, POD_MAX_PHOTOS } from '@/lib/driver/stage-photos';
import { POD_BUCKET_NAME } from '@/utils/supabase/storage';
import { DEFAULT_SIGNED_URL_EXPIRATION } from '@/config/file-config';

/**
 * Every POD photo (up to POD_MAX_PHOTOS, oldest first) for the given order
 * numbers, keyed by lower-cased order number, with URLs signed against the
 * private delivery-proofs bucket. The `deliveries` row only mirrors the
 * newest upload, so the file_uploads rows on the order are the source.
 */
async function loadPodPhotos(orderNumbers: string[]): Promise<Map<string, PODGalleryPhoto[]>> {
  const byOrder = new Map<string, PODGalleryPhoto[]>();
  if (orderNumbers.length === 0) return byOrder;

  const orderFilter = {
    orderNumber: { in: orderNumbers, mode: 'insensitive' as const },
    deletedAt: null,
  };
  const files = await prisma.fileUpload.findMany({
    where: {
      category: DELIVERY_PHOTO_CATEGORY,
      OR: [{ cateringRequest: orderFilter }, { onDemand: orderFilter }],
    },
    select: {
      id: true,
      fileUrl: true,
      filePath: true,
      uploadedAt: true,
      cateringRequest: { select: { orderNumber: true } },
      onDemand: { select: { orderNumber: true } },
    },
    orderBy: { uploadedAt: 'asc' },
  });

  const paths = files.map((f) => f.filePath).filter((p): p is string => !!p);
  let signed = new Map<string, string>();
  if (paths.length > 0) {
    const { getSignedUrlCache } = await import('@/lib/signed-url-cache');
    signed = await getSignedUrlCache().getBatchSignedUrls(
      POD_BUCKET_NAME,
      paths,
      DEFAULT_SIGNED_URL_EXPIRATION,
    );
  }

  for (const file of files) {
    const orderNumber = file.cateringRequest?.orderNumber ?? file.onDemand?.orderNumber;
    if (!orderNumber) continue;
    const key = orderNumber.toLowerCase();
    const list = byOrder.get(key) ?? [];
    if (list.length >= POD_MAX_PHOTOS) continue;
    list.push({
      id: file.id,
      url: (file.filePath && signed.get(file.filePath)) || file.fileUrl,
      uploadedAt: file.uploadedAt,
    });
    byOrder.set(key, list);
  }
  return byOrder;
}

/**
 * GET /api/tracking/deliveries/pod-gallery
 *
 * Fetches paginated proof of delivery photos for the admin gallery: one item
 * per delivery, carrying every POD photo of its order in `photos`.
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
      LEFT JOIN drivers dr ON d.driver_id = dr.id AND dr.deleted_at IS NULL
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
      LEFT JOIN drivers dr ON d.driver_id = dr.id AND dr.deleted_at IS NULL
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

    const photosByOrder = await loadPodPhotos(
      dataResult
        .map((row) => row.order_number)
        .filter((n): n is string => typeof n === 'string' && n.length > 0),
    );

    // Transform results to PODGalleryItem format. Without POD rows on the
    // order (legacy data) the deliveries mirror URL is the only photo.
    const items: PODGalleryItem[] = dataResult.map(row => {
      const photos: PODGalleryPhoto[] =
        photosByOrder.get(String(row.order_number || '').toLowerCase()) ??
        [{ id: row.id, url: row.photo_url, uploadedAt: new Date(row.captured_at) }];
      return {
        id: row.id,
        deliveryId: row.delivery_id,
        orderNumber: row.order_number || row.id,
        photoUrl: photos[0]?.url ?? row.photo_url,
        photos,
        capturedAt: new Date(row.captured_at),
        driverName: row.driver_name,
        driverId: row.driver_id,
        customerName: row.customer_name || undefined,
        deliveryAddress: row.delivery_address || undefined,
        deliveryStatus: row.status
      };
    });

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
