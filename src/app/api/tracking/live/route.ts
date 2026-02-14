import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';

/**
 * Typed result row for the active drivers query.
 *
 * These fields map 1:1 to the SQL projection below. Keeping this interface
 * in sync with the SELECT clause ensures we avoid `any` while still
 * benefiting from the performance of raw SQL.
 */
interface ActiveDriverRow {
  id: string;
  user_id: string | null;
  employee_id: string | null;
  driver_name: string | null;
  vehicle_number: string | null;
  phone_number: string | null;
  is_on_duty: boolean;
  shift_start_time: Date | null;
  current_shift_id: string | null;
  last_known_location_geojson: string | null;
  last_location_update: Date | null;
  shift_status: string | null;
  shift_start: Date | null;
  total_distance: number | null;
  active_deliveries: number | string;
}

/**
 * Typed result row for the recent driver locations query.
 */
interface RecentLocationRow {
  driver_id: string;
  location_geojson: string;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  is_moving: boolean | null;
  source: string | null;
  recorded_at: Date;
}

/**
 * Typed result row for the active deliveries query.
 */
interface ActiveDeliveryRow {
  id: string;
  driver_id: string;
  shift_id: string | null;
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_address: string | null;
  pickup_location_geojson: string | null;
  delivery_address: string | null;
  delivery_location_geojson: string | null;
  estimated_pickup_time: Date | null;
  estimated_delivery_time: Date | null;
  assigned_at: Date | null;
  accepted_at: Date | null;
  picked_up_at: Date | null;
  delivered_at: Date | null;
  priority: string | null;
  delivery_instructions: string | null;
}

/**
 * Typed result row for legacy dispatches query (catering_requests and on_demand).
 */
interface LegacyDispatchRow {
  id: string;
  driver_id: string | null;
  dispatch_driver_id: string; // Original driverId from dispatches (profile id)
  order_number: string;
  status: string;
  driver_status: string | null;
  customer_name: string | null;
  pickup_street: string | null;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  pickup_datetime: Date | null;
  arrival_datetime: Date | null;
  created_at: Date | null;
  order_type: string;
  driver_employee_id: string | null;
  driver_name: string | null;
}

/**
 * Type-safe helper to check if SSE controller is still open and accepting data
 * @param controller - The ReadableStreamDefaultController to check
 * @returns true if controller is open and ready to accept data
 */
function isControllerOpen(controller: ReadableStreamDefaultController): boolean {
  try {
    // desiredSize is null when the stream is closed
    // desiredSize is a number (can be negative) when the stream is open
    return controller.desiredSize !== null;
  } catch {
    // If we can't access desiredSize, assume controller is closed
    return false;
  }
}

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
    // Interval and cleanup function stored in outer scope so cancel() method can access them
    let intervalId: NodeJS.Timeout | null = null;
    let cleanupFn: (() => void) | null = null;

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
        intervalId = setInterval(async () => {
          // Check if controller is still open before processing
          if (!isControllerOpen(controller)) {
            if (intervalId) clearInterval(intervalId);
            return;
          }

          try {
            // Get active drivers with current locations and shifts
            // Join with profiles via profile_id to get driver name
            // Note: If drivers.profile_id is NULL, the name will be enriched client-side
            // from delivery data (see useRealTimeTracking.enrichDriverNamesFromDeliveries)
            const activeDrivers = await prisma.$queryRawUnsafe<ActiveDriverRow[]>(`
              SELECT
                d.id,
                d.user_id,
                d.employee_id,
                p.name as driver_name,
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
              LEFT JOIN profiles p ON d.profile_id = p.id
              LEFT JOIN driver_shifts ds ON d.current_shift_id = ds.id
              LEFT JOIN deliveries del ON d.id = del.driver_id AND del.deleted_at IS NULL
              WHERE d.is_active = true AND d.deleted_at IS NULL
              GROUP BY d.id, p.name, ds.id
              ORDER BY d.is_on_duty DESC, d.last_location_update DESC
            `);

            // Get recent location updates (last 5 minutes)
            const recentLocations = await prisma.$queryRawUnsafe<RecentLocationRow[]>(`
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

            // Get active deliveries with status updates (new deliveries table)
            const activeDeliveries = await prisma.$queryRawUnsafe<ActiveDeliveryRow[]>(`
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

            // Get legacy dispatches (catering_requests and on_demand) with assigned drivers
            // Note: Column names are camelCase in the database, so we need to quote them
            // Join with drivers table to get the actual driver ID (dispatches.driverId references profiles.id)
            const legacyDispatches = await prisma.$queryRawUnsafe<LegacyDispatchRow[]>(`
              SELECT
                disp.id,
                drv.id as driver_id,
                disp."driverId" as dispatch_driver_id,
                cr."orderNumber" as order_number,
                cr.status::text as status,
                cr."driverStatus"::text as driver_status,
                u.name as customer_name,
                pa.street1 as pickup_street,
                pa.city as pickup_city,
                pa.state as pickup_state,
                pa.latitude as pickup_lat,
                pa.longitude as pickup_lng,
                da.street1 as delivery_street,
                da.city as delivery_city,
                da.state as delivery_state,
                da.latitude as delivery_lat,
                da.longitude as delivery_lng,
                cr."pickupDateTime" as pickup_datetime,
                cr."arrivalDateTime" as arrival_datetime,
                disp."createdAt" as created_at,
                'catering' as order_type,
                drv.employee_id as driver_employee_id,
                dp.name as driver_name
              FROM dispatches disp
              INNER JOIN catering_requests cr ON disp."cateringRequestId" = cr.id
              LEFT JOIN drivers drv ON drv.profile_id = disp."driverId"
              LEFT JOIN profiles dp ON disp."driverId" = dp.id
              LEFT JOIN profiles u ON cr."userId" = u.id
              LEFT JOIN addresses pa ON cr."pickupAddressId" = pa.id
              LEFT JOIN addresses da ON cr."deliveryAddressId" = da.id
              WHERE disp."driverId" IS NOT NULL
              AND cr.status NOT IN ('CANCELLED')
              AND (cr."driverStatus" IS NULL OR cr."driverStatus" NOT IN ('COMPLETED'))
              AND cr."deletedAt" IS NULL

              UNION ALL

              SELECT
                disp.id,
                drv.id as driver_id,
                disp."driverId" as dispatch_driver_id,
                od."orderNumber" as order_number,
                od.status::text as status,
                od."driverStatus"::text as driver_status,
                u.name as customer_name,
                pa.street1 as pickup_street,
                pa.city as pickup_city,
                pa.state as pickup_state,
                pa.latitude as pickup_lat,
                pa.longitude as pickup_lng,
                da.street1 as delivery_street,
                da.city as delivery_city,
                da.state as delivery_state,
                da.latitude as delivery_lat,
                da.longitude as delivery_lng,
                od."pickupDateTime" as pickup_datetime,
                od."arrivalDateTime" as arrival_datetime,
                disp."createdAt" as created_at,
                'on_demand' as order_type,
                drv.employee_id as driver_employee_id,
                dp.name as driver_name
              FROM dispatches disp
              INNER JOIN on_demand_requests od ON disp."onDemandId" = od.id
              LEFT JOIN drivers drv ON drv.profile_id = disp."driverId"
              LEFT JOIN profiles dp ON disp."driverId" = dp.id
              LEFT JOIN profiles u ON od."userId" = u.id
              LEFT JOIN addresses pa ON od."pickupAddressId" = pa.id
              LEFT JOIN addresses da ON od."deliveryAddressId" = da.id
              WHERE disp."driverId" IS NOT NULL
              AND od.status NOT IN ('CANCELLED')
              AND (od."driverStatus" IS NULL OR od."driverStatus" NOT IN ('COMPLETED'))
              AND od."deletedAt" IS NULL

              ORDER BY created_at DESC
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
                  name: driver.driver_name,
                  vehicleNumber: driver.vehicle_number,
                  phoneNumber: driver.phone_number,
                  isOnDuty: driver.current_shift_id !== null && driver.shift_status === 'active',
                  shiftStartTime: driver.shift_start_time,
                  currentShiftId: driver.current_shift_id,
                  lastKnownLocation: driver.last_known_location_geojson ?
                    JSON.parse(driver.last_known_location_geojson) : null,
                  lastLocationUpdate: driver.last_location_update,
                  shiftStatus: driver.shift_status,
                  shiftStart: driver.shift_start,
                  totalDistance: driver.total_distance || 0,
                  activeDeliveries: (() => {
                    const raw = driver.active_deliveries;
                    const count =
                      typeof raw === 'number' ? raw : Number.parseInt(raw, 10);
                    return Number.isNaN(count) ? 0 : count;
                  })()
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
                activeDeliveries: [
                  // New deliveries table entries
                  ...activeDeliveries.map(delivery => ({
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
                    deliveryInstructions: delivery.delivery_instructions,
                    source: 'deliveries'
                  })),
                  // Legacy dispatches (catering_requests and on_demand)
                  ...legacyDispatches.map(dispatch => ({
                    id: dispatch.id,
                    // Use driver table ID if available, otherwise use dispatch's driverId (profile id)
                    driverId: dispatch.driver_id || dispatch.dispatch_driver_id,
                    // Expose the original dispatch driverId (profile ID) for correlation
                    // This helps client-side matching when drivers.profile_id is incorrect
                    dispatchDriverId: dispatch.dispatch_driver_id,
                    shiftId: null,
                    orderNumber: dispatch.order_number,
                    // Use driver_status for delivery tracking, fall back to order status
                    status: dispatch.driver_status || dispatch.status,
                    customerName: dispatch.customer_name,
                    customerPhone: null,
                    pickupAddress: [dispatch.pickup_street, dispatch.pickup_city, dispatch.pickup_state].filter(Boolean).join(', '),
                    pickupLocation: dispatch.pickup_lat && dispatch.pickup_lng ? {
                      type: 'Point',
                      coordinates: [dispatch.pickup_lng, dispatch.pickup_lat]
                    } : null,
                    deliveryAddress: [dispatch.delivery_street, dispatch.delivery_city, dispatch.delivery_state].filter(Boolean).join(', '),
                    deliveryLocation: dispatch.delivery_lat && dispatch.delivery_lng ? {
                      type: 'Point',
                      coordinates: [dispatch.delivery_lng, dispatch.delivery_lat]
                    } : null,
                    estimatedPickupTime: dispatch.pickup_datetime,
                    estimatedDeliveryTime: dispatch.arrival_datetime,
                    assignedAt: dispatch.created_at,
                    acceptedAt: null,
                    pickedUpAt: null,
                    deliveredAt: null,
                    priority: null,
                    deliveryInstructions: null,
                    orderType: dispatch.order_type,
                    source: 'dispatches',
                    // Include driver info for legacy dispatches
                    driverEmployeeId: dispatch.driver_employee_id,
                    driverName: dispatch.driver_name
                  }))
                ]
              }
            };

            const message = `data: ${JSON.stringify(updateData)}\n\n`;
            // Use try-catch to handle controller state atomically (avoids TOCTOU race condition)
            try {
              if (controller.desiredSize !== null) {
                controller.enqueue(new TextEncoder().encode(message));
              } else {
                // Controller already closed, cleanup interval
                if (intervalId) clearInterval(intervalId);
              }
            } catch (enqueueError) {
              // Controller was closed during enqueue operation - cleanup and stop
              if (intervalId) clearInterval(intervalId);
            }
          } catch (error) {
            console.error('Error in SSE update:', error);
            captureException(error, {
              action: 'sse_driver_update',
              feature: 'admin_tracking',
              component: 'api/tracking/live',
              handled: true,
            });
            // Use try-catch to handle controller state atomically (avoids TOCTOU race condition)
            try {
              if (controller.desiredSize !== null) {
                const errorMessage = `data: ${JSON.stringify({
                  type: 'error',
                  message: 'Error fetching driver updates',
                  timestamp: new Date().toISOString()
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(errorMessage));
              } else {
                // Controller already closed, cleanup interval
                if (intervalId) clearInterval(intervalId);
              }
            } catch (enqueueError) {
              // Controller was closed during enqueue operation - cleanup and stop
              if (intervalId) clearInterval(intervalId);
            }
          }
        }, 5000); // Update every 5 seconds

        // Cleanup function
        const cleanup = () => {
          if (intervalId) clearInterval(intervalId);
          try {
            controller.close();
          } catch (error) {
            console.error('Error closing SSE controller:', error);
          }
        };

        // Store cleanup function in outer scope for cancel() method
        cleanupFn = cleanup;

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
      },

      cancel() {
        // Clean up interval and event listener when stream is cancelled
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (cleanupFn) {
          request.signal.removeEventListener('abort', cleanupFn);
        }
      }
    });

    captureMessage('Admin tracking SSE stream started', 'info', {
      feature: 'admin_tracking',
    });

    return new NextResponse(stream, { headers });

  } catch (error) {
    console.error('Error setting up SSE endpoint:', error);
    captureException(error, {
      action: 'sse_setup',
      feature: 'admin_tracking',
      component: 'api/tracking/live',
    });
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
