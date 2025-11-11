import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';

/**
 * Server-Sent Events endpoint for real-time driver tracking updates
 * Provides live location data, shift status, and delivery updates to admin dashboard
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

    // Set up SSE headers
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initMessage = `data: ${JSON.stringify({
          type: 'connection',
          message: 'Connected to driver tracking stream',
          timestamp: new Date().toISOString()
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initMessage));

        // Set up interval for sending updates
        const interval = setInterval(async () => {
          // Check if controller is still open before processing
          if ((controller as any).desiredSize === null) {
            clearInterval(interval);
            return;
          }

          try {
            // Get active drivers with current locations and shifts
            const activeDrivers = await prisma.$queryRawUnsafe<any[]>(`
              SELECT
                d.id,
                d.user_id,
                d.employee_id,
                d.vehicle_number,
                d.phone_number,
                d.is_on_duty,
                d.shift_start_time,
                d.current_shift_id,
                ST_AsGeoJSON(d.last_known_location) as last_known_location_geojson,
                d.last_location_update,
                ds.status as shift_status,
                ds.shift_start,
                ds.total_distance,
                COUNT(CASE WHEN del.status NOT IN ('delivered', 'cancelled') THEN 1 END) as active_deliveries
              FROM drivers d
              LEFT JOIN driver_shifts ds ON d.current_shift_id = ds.id
              LEFT JOIN deliveries del ON d.id = del.driver_id AND del.deleted_at IS NULL
              WHERE d.is_active = true AND d.deleted_at IS NULL
              GROUP BY d.id, ds.id
              ORDER BY d.is_on_duty DESC, d.last_location_update DESC
            `);

            // Get recent location updates (last 5 minutes)
            const recentLocations = await prisma.$queryRawUnsafe<any[]>(`
              SELECT
                dl.driver_id,
                ST_AsGeoJSON(dl.location) as location_geojson,
                dl.accuracy,
                dl.speed,
                dl.heading,
                dl.battery_level,
                dl.is_moving,
                dl.source,
                dl.recorded_at
              FROM driver_locations dl
              WHERE dl.recorded_at > NOW() - INTERVAL '5 minutes'
              AND dl.driver_id IN (
                SELECT id FROM drivers WHERE is_active = true AND is_on_duty = true
              )
              AND dl.deleted_at IS NULL
              ORDER BY dl.recorded_at DESC
            `);

            // Get active deliveries with status updates
            const activeDeliveries = await prisma.$queryRawUnsafe<any[]>(`
              SELECT
                d.id,
                d.driver_id,
                d.shift_id,
                d.order_number,
                d.status,
                d.customer_name,
                d.customer_phone,
                d.pickup_address,
                ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
                d.delivery_address,
                ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
                d.estimated_pickup_time,
                d.estimated_delivery_time,
                d.assigned_at,
                d.accepted_at,
                d.picked_up_at,
                d.delivered_at,
                d.priority,
                d.delivery_instructions
              FROM deliveries d
              WHERE d.status NOT IN ('delivered', 'cancelled')
              AND d.driver_id IS NOT NULL
              AND d.deleted_at IS NULL
              ORDER BY d.assigned_at DESC
            `);

            // Format the data for SSE
            const updateData = {
              type: 'driver_update',
              timestamp: new Date().toISOString(),
              data: {
                activeDrivers: activeDrivers.map(driver => ({
                  id: driver.id,
                  userId: driver.user_id,
                  employeeId: driver.employee_id,
                  vehicleNumber: driver.vehicle_number,
                  phoneNumber: driver.phone_number,
                  isOnDuty: driver.is_on_duty,
                  shiftStartTime: driver.shift_start_time,
                  currentShiftId: driver.current_shift_id,
                  lastKnownLocation: driver.last_known_location_geojson ?
                    JSON.parse(driver.last_known_location_geojson) : null,
                  lastLocationUpdate: driver.last_location_update,
                  shiftStatus: driver.shift_status,
                  shiftStart: driver.shift_start,
                  totalDistance: driver.total_distance || 0,
                  activeDeliveries: parseInt(driver.active_deliveries) || 0
                })),
                recentLocations: recentLocations.map(loc => ({
                  driverId: loc.driver_id,
                  location: JSON.parse(loc.location_geojson),
                  accuracy: loc.accuracy,
                  speed: loc.speed,
                  heading: loc.heading,
                  batteryLevel: loc.battery_level,
                  isMoving: loc.is_moving,
                  source: loc.source,
                  recordedAt: loc.recorded_at
                })),
                activeDeliveries: activeDeliveries.map(delivery => ({
                  id: delivery.id,
                  driverId: delivery.driver_id,
                  shiftId: delivery.shift_id,
                  orderNumber: delivery.order_number,
                  status: delivery.status,
                  customerName: delivery.customer_name,
                  customerPhone: delivery.customer_phone,
                  pickupAddress: delivery.pickup_address,
                  pickupLocation: delivery.pickup_location_geojson ?
                    JSON.parse(delivery.pickup_location_geojson) : null,
                  deliveryAddress: delivery.delivery_address,
                  deliveryLocation: delivery.delivery_location_geojson ?
                    JSON.parse(delivery.delivery_location_geojson) : null,
                  estimatedPickupTime: delivery.estimated_pickup_time,
                  estimatedDeliveryTime: delivery.estimated_delivery_time,
                  assignedAt: delivery.assigned_at,
                  acceptedAt: delivery.accepted_at,
                  pickedUpAt: delivery.picked_up_at,
                  deliveredAt: delivery.delivered_at,
                  priority: delivery.priority,
                  deliveryInstructions: delivery.delivery_instructions
                }))
              }
            };

            const message = `data: ${JSON.stringify(updateData)}\n\n`;
            // Check controller is still open before enqueueing
            try {
              if ((controller as any).desiredSize !== null) {
                controller.enqueue(new TextEncoder().encode(message));
              }
            } catch (enqueueError) {
              // Controller was closed between check and enqueue - safe to ignore
              clearInterval(interval);
            }
          } catch (error) {
            console.error('Error in SSE update:', error);
            // Check controller is still open before enqueueing error
            try {
              if ((controller as any).desiredSize !== null) {
                const errorMessage = `data: ${JSON.stringify({
                  type: 'error',
                  message: 'Error fetching driver updates',
                  timestamp: new Date().toISOString()
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(errorMessage));
              }
            } catch (enqueueError) {
              // Controller was closed between check and enqueue - safe to ignore
              clearInterval(interval);
            }
          }
        }, 5000); // Update every 5 seconds

        // Cleanup function
        const cleanup = () => {
          clearInterval(interval);
          try {
            controller.close();
          } catch (error) {
            console.error('Error closing SSE controller:', error);
          }
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);

        // Store cleanup function for potential manual cleanup
        (controller as any).cleanup = cleanup;
      },

      cancel() {
              }
    });

    return new NextResponse(stream, { headers });

  } catch (error) {
    console.error('Error setting up SSE endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to establish live connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
