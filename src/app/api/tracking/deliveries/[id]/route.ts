import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { DriverStatus } from '@/types/user';

// GET - Get specific delivery details
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
        dr.vehicle_number,
        dr.user_id
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE d.id = $1
    `;

    const params_array = [id];

    // If user is DRIVER, verify they own this delivery
    if (authResult.context.user.type === 'DRIVER') {
      query += ` AND dr.user_id = $2`;
      params_array.push(authResult.context.user.id);
    }

    const result = await prisma.$queryRawUnsafe<any[]>(query, ...params_array);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = result[0];

    const deliveryData = {
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
    };

    return NextResponse.json({
      success: true,
      data: deliveryData
    });

  } catch (error) {
    console.error('Error fetching delivery:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch delivery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT - Update delivery status
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
    const { status, location, proofOfDelivery, notes } = body;

    // Verify delivery exists and user has permission
    let verifyQuery = `
      SELECT d.driver_id, d.status, dr.user_id
      FROM deliveries d
      LEFT JOIN drivers dr ON d.driver_id = dr.id
      WHERE d.id = $1
    `;

    const verifyResult = await prisma.$queryRawUnsafe<{
      driver_id: string;
      status: string;
      user_id?: string;
    }[]>(verifyQuery, id);

    if (verifyResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = verifyResult[0];

    // If user is DRIVER, verify they own this delivery
    if (authResult.context.user.type === 'DRIVER' && delivery?.user_id !== authResult.context.user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Validate status transition
    const validStatuses: DriverStatus[] = [DriverStatus.ASSIGNED, DriverStatus.EN_ROUTE_TO_CLIENT, DriverStatus.ARRIVED_TO_CLIENT, DriverStatus.COMPLETED];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Prepare update fields
    const updateFields: string[] = ['updated_at = NOW()'];
    const params_array: any[] = [id];
    let paramCounter = 2;

    if (status) {
      updateFields.push(`status = $${paramCounter}`);
      params_array.push(status);
      paramCounter++;

      // Set timestamp fields based on status
      switch (status) {
        case 'STARTED':
          updateFields.push('started_at = NOW()');
          break;
        case 'ARRIVED':
          updateFields.push('arrived_at = NOW()');
          break;
        case 'DELIVERED':
          updateFields.push('completed_at = NOW()');
          break;
      }
    }

    if (location && location.coordinates) {
      updateFields.push(`location = ST_GeogFromText($${paramCounter})`);
      params_array.push(`POINT(${location.coordinates.lng} ${location.coordinates.lat})`);
      paramCounter++;
    }

    if (proofOfDelivery) {
      updateFields.push(`proof_of_delivery = $${paramCounter}`);
      params_array.push(proofOfDelivery);
      paramCounter++;
    }

    if (notes) {
      updateFields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${paramCounter}::jsonb`);
      params_array.push(JSON.stringify({ 
        notes, 
        statusUpdatedAt: new Date().toISOString(),
        updatedBy: authResult.context.user.id
      }));
      paramCounter++;
    }

    // Update delivery record
    await prisma.$executeRawUnsafe(`
      UPDATE deliveries 
      SET ${updateFields.join(', ')}
      WHERE id = $1::uuid
    `, ...params_array);

    // Update driver location if provided
    if (location && location.coordinates && delivery?.driver_id) {
      await prisma.$executeRawUnsafe(`
        UPDATE drivers 
        SET 
          last_known_location = ST_GeogFromText($2),
          last_location_update = NOW(),
          updated_at = NOW()
        WHERE id = $1::uuid
      `,
        delivery.driver_id,
        `POINT(${location.coordinates.lng} ${location.coordinates.lat})`
      );
    }

    // Update delivery count in current shift if delivery is completed
    if (status === DriverStatus.COMPLETED && delivery?.driver_id) {
      await prisma.$executeRawUnsafe(`
        UPDATE driver_shifts 
        SET 
          delivery_count = delivery_count + 1,
          updated_at = NOW()
        WHERE driver_id = $1::uuid 
        AND status = 'active'
      `, delivery.driver_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery updated successfully'
    });

  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update delivery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE - Cancel delivery (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
      requireAuth: true
    });

    if (!authResult.success) {
      return authResult.response;
    }

    // Check if delivery exists and can be cancelled
    const deliveryResult = await prisma.$queryRawUnsafe<{ status: string }[]>(`
      SELECT status FROM deliveries WHERE id = $1
    `, id);

    if (deliveryResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult[0];

    if (delivery?.status === 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: 'Cannot cancel completed delivery' },
        { status: 400 }
      );
    }

    // Cancel delivery
    await prisma.$executeRawUnsafe(`
      UPDATE deliveries 
      SET 
        status = 'CANCELLED',
        metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
    `, 
      id,
      JSON.stringify({
        cancelledAt: new Date().toISOString(),
        cancelledBy: authResult.context.user.id
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Delivery cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling delivery:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel delivery',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}