import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import type { DriverStatus } from '@/types/user';

// GET - Get deliveries (filtered by driver for driver role, all for admin)
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

    let query = `
      SELECT 
        d.id,
        d.catering_request_id,
        d.on_demand_id,
        d.driver_id,
        d.status,
        ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
        ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
        d.estimated_arrival,
        d.actual_arrival,
        d.proof_of_delivery,
        d.actual_distance_km,
        d.route_polyline,
        d.metadata,
        d.assigned_at,
        d.started_at,
        d.arrived_at,
        d.completed_at,
        d.created_at,
        d.updated_at,
        dr.employee_id,
        dr.vehicle_number
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCounter = 1;

    // If user is DRIVER, only show their own deliveries
    if (authResult.context.user.type === 'DRIVER') {
      query += ` AND d.driver_id = (SELECT id FROM drivers WHERE user_id = $${paramCounter})`;
      params.push(authResult.context.user.id);
      paramCounter++;
    } else if (driverId) {
      query += ` AND d.driver_id = $${paramCounter}`;
      params.push(driverId);
      paramCounter++;
    }

    if (status) {
      query += ` AND d.status = $${paramCounter}`;
      params.push(status);
      paramCounter++;
    }

    query += ` ORDER BY d.assigned_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    params.push(limit, offset);

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    const deliveries = result.map(delivery => ({
      id: delivery.id,
      cateringRequestId: delivery.catering_request_id,
      onDemandId: delivery.on_demand_id,
      driverId: delivery.driver_id,
      status: delivery.status,
      pickupLocation: delivery.pickup_location_geojson ? 
        JSON.parse(delivery.pickup_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      deliveryLocation: delivery.delivery_location_geojson ? 
        JSON.parse(delivery.delivery_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      estimatedArrival: delivery.estimated_arrival,
      actualArrival: delivery.actual_arrival,
      route: [], // Route points loaded separately if needed
      proofOfDelivery: delivery.proof_of_delivery,
      actualDistanceKm: delivery.actual_distance_km,
      routePolyline: delivery.route_polyline,
      metadata: delivery.metadata,
      assignedAt: delivery.assigned_at,
      startedAt: delivery.started_at,
      arrivedAt: delivery.arrived_at,
      completedAt: delivery.completed_at,
      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at,
      // Additional driver info for admin views
      driverInfo: authResult.context.user.type !== 'DRIVER' ? {
        employeeId: delivery.employee_id,
        vehicleNumber: delivery.vehicle_number
      } : undefined
    }));

    return NextResponse.json({
      success: true,
      data: deliveries,
      pagination: {
        limit,
        offset,
        total: deliveries.length
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