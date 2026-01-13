import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import type { DriverStatus } from '@/types/user';

// GET - Get deliveries (filtered by driver for driver role, all for admin)
// This endpoint now fetches from both the `deliveries` table AND the `dispatches` table
// to support both the new delivery tracking system and the legacy dispatch system.
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
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const source = searchParams.get('source'); // 'deliveries', 'dispatches', or null for both

    const allDeliveries: any[] = [];

    // ============================================================
    // PART 1: Fetch from deliveries table (new tracking system)
    // ============================================================
    if (!source || source === 'deliveries') {
      let deliveryQuery = `
        SELECT
          d.id,
          d.driver_id,
          d.status,
          ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
          ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
          d.estimated_delivery_time as estimated_arrival,
          d.delivered_at as actual_arrival,
          d.assigned_at,
          d.picked_up_at as started_at,
          d.delivered_at as arrived_at,
          d.delivered_at as completed_at,
          d.created_at,
          d.updated_at,
          d.order_number,
          d.customer_name,
          d.pickup_address,
          d.delivery_address,
          d.delivery_photo_url as proof_of_delivery,
          'delivery' as source_type
        FROM deliveries d
        WHERE d.deleted_at IS NULL
      `;

      const deliveryParams: any[] = [];
      let deliveryParamCounter = 1;

      // If user is DRIVER, only show their own deliveries
      // Note: driver_id in deliveries table should match the profile/user ID
      if (authResult.context.user.type === 'DRIVER') {
        deliveryQuery += ` AND d.driver_id = $${deliveryParamCounter}::uuid`;
        deliveryParams.push(authResult.context.user.id);
        deliveryParamCounter++;
      } else if (driverId) {
        deliveryQuery += ` AND d.driver_id = $${deliveryParamCounter}::uuid`;
        deliveryParams.push(driverId);
        deliveryParamCounter++;
      }

      if (status) {
        deliveryQuery += ` AND d.status = $${deliveryParamCounter}`;
        deliveryParams.push(status);
        deliveryParamCounter++;
      }

      deliveryQuery += ` ORDER BY d.assigned_at DESC`;

      try {
        const deliveryResult = await prisma.$queryRawUnsafe<any[]>(deliveryQuery, ...deliveryParams);

        for (const delivery of deliveryResult) {
          allDeliveries.push({
            id: delivery.id,
            driverId: delivery.driver_id,
            status: delivery.status,
            pickupLocation: delivery.pickup_location_geojson ?
              JSON.parse(delivery.pickup_location_geojson).coordinates.reverse() : null,
            deliveryLocation: delivery.delivery_location_geojson ?
              JSON.parse(delivery.delivery_location_geojson).coordinates.reverse() : null,
            orderNumber: delivery.order_number,
            customerName: delivery.customer_name,
            pickupAddress: delivery.pickup_address,
            deliveryAddress: delivery.delivery_address,
            estimatedArrival: delivery.estimated_arrival,
            actualArrival: delivery.actual_arrival,
            route: [],
            proofOfDelivery: delivery.proof_of_delivery,
            assignedAt: delivery.assigned_at,
            startedAt: delivery.started_at,
            arrivedAt: delivery.arrived_at,
            completedAt: delivery.completed_at,
            createdAt: delivery.created_at,
            updatedAt: delivery.updated_at,
            sourceType: 'delivery',
          });
        }
      } catch (err) {
        // Deliveries table might not exist in older deployments, continue
        console.warn('Could not fetch from deliveries table:', err);
      }
    }

    // ============================================================
    // PART 2: Fetch from dispatches table (legacy dispatch system)
    // Gets location data from associated order addresses
    // ============================================================
    if (!source || source === 'dispatches') {
      let dispatchQuery = `
        SELECT
          disp.id,
          disp."cateringRequestId" as catering_request_id,
          disp."onDemandId" as on_demand_id,
          disp."driverId" as driver_id,
          disp."createdAt" as assigned_at,
          disp."updatedAt" as updated_at,
          -- Catering request data
          cr."orderNumber" as cr_order_number,
          cr.status as cr_status,
          cr."driverStatus" as cr_driver_status,
          cr."clientAttention" as cr_customer_name,
          cr."pickupDateTime" as cr_pickup_time,
          cr."arrivalDateTime" as cr_arrival_time,
          -- Catering pickup address
          pa_cr.street1 as cr_pickup_street,
          pa_cr.city as cr_pickup_city,
          pa_cr.state as cr_pickup_state,
          pa_cr.zip as cr_pickup_zip,
          pa_cr.latitude as cr_pickup_lat,
          pa_cr.longitude as cr_pickup_lng,
          -- Catering delivery address
          da_cr.street1 as cr_delivery_street,
          da_cr.city as cr_delivery_city,
          da_cr.state as cr_delivery_state,
          da_cr.zip as cr_delivery_zip,
          da_cr.latitude as cr_delivery_lat,
          da_cr.longitude as cr_delivery_lng,
          -- On-demand data
          od."orderNumber" as od_order_number,
          od.status as od_status,
          od."driverStatus" as od_driver_status,
          od."clientAttention" as od_customer_name,
          od."pickupDateTime" as od_pickup_time,
          od."arrivalDateTime" as od_arrival_time,
          -- On-demand pickup address
          pa_od.street1 as od_pickup_street,
          pa_od.city as od_pickup_city,
          pa_od.state as od_pickup_state,
          pa_od.zip as od_pickup_zip,
          pa_od.latitude as od_pickup_lat,
          pa_od.longitude as od_pickup_lng,
          -- On-demand delivery address
          da_od.street1 as od_delivery_street,
          da_od.city as od_delivery_city,
          da_od.state as od_delivery_state,
          da_od.zip as od_delivery_zip,
          da_od.latitude as od_delivery_lat,
          da_od.longitude as od_delivery_lng,
          -- Driver info
          drv.name as driver_name,
          drv.email as driver_email,
          'dispatch' as source_type
        FROM dispatches disp
        LEFT JOIN catering_requests cr ON disp."cateringRequestId" = cr.id
        LEFT JOIN addresses pa_cr ON cr."pickupAddressId" = pa_cr.id
        LEFT JOIN addresses da_cr ON cr."deliveryAddressId" = da_cr.id
        LEFT JOIN on_demand_requests od ON disp."onDemandId" = od.id
        LEFT JOIN addresses pa_od ON od."pickupAddressId" = pa_od.id
        LEFT JOIN addresses da_od ON od."deliveryAddressId" = da_od.id
        LEFT JOIN profiles drv ON disp."driverId" = drv.id
        WHERE disp."driverId" IS NOT NULL
      `;

      const dispatchParams: any[] = [];
      let dispatchParamCounter = 1;

      // If user is DRIVER, only show their own dispatches
      if (authResult.context.user.type === 'DRIVER') {
        dispatchQuery += ` AND disp."driverId" = $${dispatchParamCounter}::uuid`;
        dispatchParams.push(authResult.context.user.id);
        dispatchParamCounter++;
      } else if (driverId) {
        dispatchQuery += ` AND disp."driverId" = $${dispatchParamCounter}::uuid`;
        dispatchParams.push(driverId);
        dispatchParamCounter++;
      }

      // Filter by order status if provided (map to appropriate status)
      if (status) {
        // Dispatch doesn't have status, but we can filter by order status
        dispatchQuery += ` AND (cr.status = $${dispatchParamCounter} OR od.status = $${dispatchParamCounter}
                            OR cr."driverStatus" = $${dispatchParamCounter} OR od."driverStatus" = $${dispatchParamCounter})`;
        dispatchParams.push(status);
        dispatchParamCounter++;
      }

      // Exclude completed/cancelled orders for simulator (only show active deliveries)
      dispatchQuery += ` AND (
        (cr.id IS NOT NULL AND cr.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') AND cr."deletedAt" IS NULL)
        OR
        (od.id IS NOT NULL AND od.status NOT IN ('COMPLETED', 'DELIVERED', 'CANCELLED') AND od."deletedAt" IS NULL)
      )`;

      dispatchQuery += ` ORDER BY disp."createdAt" DESC`;

      try {
        const dispatchResult = await prisma.$queryRawUnsafe<any[]>(dispatchQuery, ...dispatchParams);

        for (const dispatch of dispatchResult) {
          // Determine if this is catering or on-demand and extract relevant data
          const isCatering = dispatch.catering_request_id !== null;

          const orderNumber = isCatering ? dispatch.cr_order_number : dispatch.od_order_number;
          const orderStatus = isCatering ? dispatch.cr_status : dispatch.od_status;
          const driverStatus = isCatering ? dispatch.cr_driver_status : dispatch.od_driver_status;
          const customerName = isCatering ? dispatch.cr_customer_name : dispatch.od_customer_name;
          const pickupTime = isCatering ? dispatch.cr_pickup_time : dispatch.od_pickup_time;
          const arrivalTime = isCatering ? dispatch.cr_arrival_time : dispatch.od_arrival_time;

          // Get pickup location (prefer lat/lng, fall back to constructing address string)
          const pickupLat = isCatering ? dispatch.cr_pickup_lat : dispatch.od_pickup_lat;
          const pickupLng = isCatering ? dispatch.cr_pickup_lng : dispatch.od_pickup_lng;
          const pickupStreet = isCatering ? dispatch.cr_pickup_street : dispatch.od_pickup_street;
          const pickupCity = isCatering ? dispatch.cr_pickup_city : dispatch.od_pickup_city;
          const pickupState = isCatering ? dispatch.cr_pickup_state : dispatch.od_pickup_state;
          const pickupZip = isCatering ? dispatch.cr_pickup_zip : dispatch.od_pickup_zip;

          // Get delivery location
          const deliveryLat = isCatering ? dispatch.cr_delivery_lat : dispatch.od_delivery_lat;
          const deliveryLng = isCatering ? dispatch.cr_delivery_lng : dispatch.od_delivery_lng;
          const deliveryStreet = isCatering ? dispatch.cr_delivery_street : dispatch.od_delivery_street;
          const deliveryCity = isCatering ? dispatch.cr_delivery_city : dispatch.od_delivery_city;
          const deliveryState = isCatering ? dispatch.cr_delivery_state : dispatch.od_delivery_state;
          const deliveryZip = isCatering ? dispatch.cr_delivery_zip : dispatch.od_delivery_zip;

          // Only include if we have valid coordinates for both pickup and delivery
          const hasPickupCoords = pickupLat !== null && pickupLng !== null;
          const hasDeliveryCoords = deliveryLat !== null && deliveryLng !== null;

          allDeliveries.push({
            id: dispatch.id,
            cateringRequestId: dispatch.catering_request_id,
            onDemandId: dispatch.on_demand_id,
            driverId: dispatch.driver_id,
            status: driverStatus || orderStatus || 'ASSIGNED',
            pickupLocation: hasPickupCoords ? [pickupLat, pickupLng] : null,
            deliveryLocation: hasDeliveryCoords ? [deliveryLat, deliveryLng] : null,
            orderNumber: orderNumber,
            customerName: customerName,
            pickupAddress: [pickupStreet, pickupCity, pickupState, pickupZip].filter(Boolean).join(', '),
            deliveryAddress: [deliveryStreet, deliveryCity, deliveryState, deliveryZip].filter(Boolean).join(', '),
            estimatedArrival: arrivalTime,
            estimatedPickup: pickupTime,
            route: [],
            assignedAt: dispatch.assigned_at,
            updatedAt: dispatch.updated_at,
            createdAt: dispatch.assigned_at,
            sourceType: 'dispatch',
            orderType: isCatering ? 'catering' : 'on_demand',
            // Include whether coordinates are available
            hasCoordinates: hasPickupCoords && hasDeliveryCoords,
          });
        }
      } catch (err) {
        console.error('Error fetching from dispatches table:', err);
      }
    }

    // Sort combined results by assignedAt desc and apply pagination
    allDeliveries.sort((a, b) => {
      const dateA = new Date(a.assignedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.assignedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const paginatedDeliveries = allDeliveries.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedDeliveries,
      pagination: {
        limit,
        offset,
        total: allDeliveries.length
      }
    });

  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch deliveries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST - Create new delivery (admin only)
export async function POST(request: NextRequest) {
  try {
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const body = await request.json();
    const {
      driverId,
      pickupLocation,
      deliveryLocation,
      cateringRequestId,
      onDemandId,
      estimatedArrival,
      metadata = {}
    } = body;

    // Validate required fields
    if (!driverId || !pickupLocation || !deliveryLocation) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: driverId, pickupLocation, deliveryLocation' 
        },
        { status: 400 }
      );
    }

    // Verify driver exists and is active
    const driverResult = await prisma.$queryRawUnsafe<{ id: string; is_active: boolean }[]>(`
      SELECT id, is_active 
      FROM drivers 
      WHERE id = $1
    `, driverId);

    if (driverResult.length === 0 || !driverResult[0]?.is_active) {
      return NextResponse.json(
        { success: false, error: 'Driver not found or inactive' },
        { status: 404 }
      );
    }

    // Create delivery record
    const insertQuery = `
      INSERT INTO deliveries (
        driver_id,
        pickup_location,
        delivery_location,
        catering_request_id,
        on_demand_id,
        estimated_arrival,
        status,
        assigned_at,
        metadata
      ) VALUES (
        $1::uuid,
        ST_GeogFromText($2),
        ST_GeogFromText($3),
        $4::uuid,
        $5::uuid,
        $6::timestamptz,
        'ASSIGNED',
        NOW(),
        $7::jsonb
      )
      RETURNING id, assigned_at
    `;

    const result = await prisma.$queryRawUnsafe<{ id: string; assigned_at: Date }[]>(
      insertQuery,
      driverId,
      `POINT(${pickupLocation.lng} ${pickupLocation.lat})`,
      `POINT(${deliveryLocation.lng} ${deliveryLocation.lat})`,
      cateringRequestId || null,
      onDemandId || null,
      estimatedArrival || null,
      JSON.stringify(metadata)
    );

    return NextResponse.json({
      success: true,
      data: {
        deliveryId: result[0]?.id,
        assignedAt: result[0]?.assigned_at,
        status: 'ASSIGNED'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create delivery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}