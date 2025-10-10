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
                ds.start_time as shift_start,
                ds.delivery_count,
                ds.total_distance_km,
                COUNT(CASE WHEN del.status NOT IN ('DELIVERED', 'CANCELLED') THEN 1 END) as active_deliveries
              FROM drivers d
              LEFT JOIN driver_shifts ds ON d.current_shift_id = ds.id
              LEFT JOIN deliveries del ON d.id = del.driver_id
              WHERE d.is_active = true
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
                dl.activity_type,
                dl.recorded_at
              FROM driver_locations dl
              WHERE dl.recorded_at > NOW() - INTERVAL '5 minutes'
              AND dl.driver_id IN (
                SELECT id FROM drivers WHERE is_active = true AND is_on_duty = true
              )
              ORDER BY dl.recorded_at DESC
            `);

            // Get active deliveries with status updates
            const activeDeliveries = await prisma.$queryRawUnsafe<any[]>(`
              SELECT 
                d.id,
                d.driver_id,
                d.status,
                d.catering_request_id,
                d.on_demand_id,
                ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
                ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
                d.estimated_arrival,
                d.assigned_at,
                d.started_at,
                d.arrived_at,
                d.completed_at,
                d.metadata
              FROM deliveries d
              WHERE d.status NOT IN ('DELIVERED', 'CANCELLED')
              AND d.driver_id IS NOT NULL
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
                  deliveryCount: driver.delivery_count || 0,
                  totalDistanceKm: driver.total_distance_km || 0,
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
                  activityType: loc.activity_type,
                  recordedAt: loc.recorded_at
                })),
                activeDeliveries: activeDeliveries.map(delivery => ({
                  id: delivery.id,
                  driverId: delivery.driver_id,
                  status: delivery.status,
                  cateringRequestId: delivery.catering_request_id,
                  onDemandId: delivery.on_demand_id,
                  pickupLocation: delivery.pickup_location_geojson ? 
                    JSON.parse(delivery.pickup_location_geojson) : null,
                  deliveryLocation: delivery.delivery_location_geojson ? 
                    JSON.parse(delivery.delivery_location_geojson) : null,
                  estimatedArrival: delivery.estimated_arrival,
                  assignedAt: delivery.assigned_at,
                  startedAt: delivery.started_at,
                  arrivedAt: delivery.arrived_at,
                  completedAt: delivery.completed_at,
                  metadata: delivery.metadata
                }))
              }
            };

            const message = `data: ${JSON.stringify(updateData)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
          } catch (error) {
            console.error('Error in SSE update:', error);
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              message: 'Error fetching driver updates',
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorMessage));
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
