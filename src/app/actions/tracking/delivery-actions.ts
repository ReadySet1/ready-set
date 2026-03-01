'use server';

import { prisma } from '@/utils/prismaDB';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { LocationUpdate, DeliveryTracking } from '@/types/tracking';
import { DriverStatus } from '@/types/user';
import { getTimestampUpdatesForStatus } from '@/lib/delivery-status-transitions';

/**
 * Update delivery status with location and optional proof of delivery
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DriverStatus,
  location?: LocationUpdate,
  proofOfDelivery?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current delivery info
    const delivery = await prisma.$queryRawUnsafe<{
      driver_id: string;
    }[]>(`
      SELECT driver_id
      FROM deliveries
      WHERE id = $1::uuid
    `, deliveryId);

    if (delivery.length === 0) {
      return { success: false, error: 'Delivery not found' };
    }

    const deliveryRecord = delivery[0];

    // Prepare update fields
    const updateFields: string[] = ['status = $2', 'updated_at = NOW()'];
    const params: any[] = [deliveryId, status];
    let paramCounter = 3;

    // Note: Location is tracked on the driver record, not delivery
    // Driver location update happens below via the drivers table

    // Add proof of delivery if provided (uses delivery_photo_url column)
    if (proofOfDelivery) {
      updateFields.push(`delivery_photo_url = $${paramCounter}`);
      params.push(proofOfDelivery);
      paramCounter++;
    }

    // Add notes to delivery_notes if provided
    if (notes) {
      updateFields.push(`delivery_notes = $${paramCounter}`);
      params.push(notes);
      paramCounter++;
    }

    // Set timestamp fields based on status
    updateFields.push(...getTimestampUpdatesForStatus(status));

    // Update delivery record
    await prisma.$executeRawUnsafe(`
      UPDATE deliveries 
      SET ${updateFields.join(', ')}
      WHERE id = $1::uuid
    `, ...params);

    // Update driver location if provided
    if (location && deliveryRecord?.driver_id) {
      await prisma.$executeRawUnsafe(`
        UPDATE drivers 
        SET 
          last_known_location = ST_GeogFromText($2),
          last_location_update = NOW(),
          updated_at = NOW()
        WHERE id = $1::uuid
      `,
        deliveryRecord.driver_id,
        `POINT(${location.coordinates.lng} ${location.coordinates.lat})`
      );
    }

    // Update delivery count in current shift if delivery is completed
    if (status === DriverStatus.COMPLETED && deliveryRecord?.driver_id) {
      await prisma.$executeRawUnsafe(`
        UPDATE driver_shifts 
        SET 
          delivery_count = delivery_count + 1,
          updated_at = NOW()
        WHERE driver_id = $1::uuid 
        AND status = 'active'
      `, deliveryRecord.driver_id);
    }

    // Note: catering_request_id and on_demand_id columns don't exist in deliveries table
    // If order linking is needed, it should be implemented via a separate mechanism

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');
    revalidatePath('/admin/orders');

    return { success: true };
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update delivery status'
    };
  }
}

/**
 * Assign a delivery to a driver
 */
export async function assignDeliveryToDriver(
  deliveryId: string,
  driverId: string,
  estimatedArrival?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate UUIDs
    if (!z.string().uuid().safeParse(deliveryId).success) {
      return { success: false, error: 'Invalid deliveryId' };
    }
    if (!z.string().uuid().safeParse(driverId).success) {
      return { success: false, error: 'Invalid driverId' };
    }
    // Verify driver exists and is active
    const driver = await prisma.$queryRawUnsafe<{ id: string; is_active: boolean }[]>(`
      SELECT id, is_active 
      FROM drivers 
      WHERE id = $1::uuid
    `, driverId);

    if (driver.length === 0 || !driver[0]?.is_active) {
      return { success: false, error: 'Driver not found or inactive' };
    }

    // Update delivery assignment
    const updateFields = ['driver_id = $2', 'assigned_at = NOW()', 'updated_at = NOW()'];
    const params = [deliveryId, driverId];

    if (estimatedArrival) {
      updateFields.push('estimated_arrival = $3');
      params.push(estimatedArrival.toISOString());
    }

    await prisma.$executeRawUnsafe(`
      UPDATE deliveries 
      SET ${updateFields.join(', ')}
      WHERE id = $1::uuid
    `, ...params);

    revalidatePath('/admin/tracking');
    revalidatePath('/admin/dispatch');

    return { success: true };
  } catch (error) {
    console.error('Error assigning delivery to driver:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign delivery'
    };
  }
}

/**
 * Create a new delivery record
 */
export async function createDelivery(
  driverId: string,
  pickupLocation: { lat: number; lng: number },
  deliveryLocation: { lat: number; lng: number },
  cateringRequestId?: string,
  onDemandId?: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; deliveryId?: string; error?: string }> {
  try {
    if (!z.string().uuid().safeParse(driverId).success) {
      return { success: false, error: 'Invalid driverId' };
    }
    // Insert delivery record
    const result = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      INSERT INTO deliveries (
        driver_id,
        pickup_location,
        delivery_location,
        catering_request_id,
        on_demand_id,
        status,
        assigned_at,
        metadata
      ) VALUES (
        $1::uuid,
        ST_GeogFromText($2),
        ST_GeogFromText($3),
        $4::uuid,
        $5::uuid,
        'ASSIGNED',
        NOW(),
        $6::jsonb
      )
      RETURNING id
    `,
      driverId,
      `POINT(${pickupLocation.lng} ${pickupLocation.lat})`,
      `POINT(${deliveryLocation.lng} ${deliveryLocation.lat})`,
      cateringRequestId || null,
      onDemandId || null,
      JSON.stringify(metadata)
    );

    revalidatePath('/admin/tracking');
    revalidatePath('/admin/dispatch');

    return {
      success: true,
      deliveryId: result[0]?.id
    };
  } catch (error) {
    console.error('Error creating delivery:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create delivery'
    };
  }
}

/**
 * Get active deliveries for a driver
 */
export async function getDriverActiveDeliveries(driverId: string): Promise<DeliveryTracking[]> {
  try {
    if (!z.string().uuid().safeParse(driverId).success) {
      return [];
    }
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        d.id,
        d.driver_id,
        d.status,
        ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
        ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
        d.estimated_delivery_time,
        d.delivered_at,
        d.delivery_photo_url,
        d.delivery_notes,
        d.assigned_at,
        d.arrived_at_vendor_at,
        d.picked_up_at,
        d.en_route_at,
        d.arrived_at_client_at,
        d.created_at,
        d.updated_at
      FROM deliveries d
      WHERE d.driver_id = $1::uuid
      AND d.status NOT IN ('DELIVERED', 'CANCELLED')
      AND d.deleted_at IS NULL
      ORDER BY d.assigned_at ASC
    `, driverId);

    return result.map(delivery => ({
      id: delivery.id,
      cateringRequestId: undefined, // Column doesn't exist in schema
      onDemandId: undefined, // Column doesn't exist in schema
      driverId: delivery.driver_id,
      status: delivery.status,
      pickupLocation: delivery.pickup_location_geojson ?
        JSON.parse(delivery.pickup_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      deliveryLocation: delivery.delivery_location_geojson ?
        JSON.parse(delivery.delivery_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      estimatedArrival: delivery.estimated_delivery_time,
      actualArrival: delivery.delivered_at,
      route: [], // Route points loaded separately if needed
      proofOfDelivery: delivery.delivery_photo_url,
      actualDistanceMiles: undefined, // Column doesn't exist in schema
      routePolyline: undefined, // Column doesn't exist in schema
      metadata: delivery.delivery_notes ? { notes: delivery.delivery_notes } : {},
      assignedAt: delivery.assigned_at,
      arrivedAtVendorAt: delivery.arrived_at_vendor_at,
      startedAt: delivery.picked_up_at,
      enRouteAt: delivery.en_route_at,
      arrivedAt: delivery.arrived_at_client_at,
      completedAt: delivery.delivered_at,
      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at
    }));
  } catch (error) {
    console.error('Error getting driver active deliveries:', error);
    return [];
  }
}

/**
 * Upload proof of delivery image and update database
 *
 * @param deliveryId - The delivery UUID
 * @param file - The image file as a File or Blob
 * @param description - Optional description
 * @returns Success status with URL or error message
 */
export async function uploadProofOfDelivery(
  deliveryId: string,
  file: File | Blob,
  description?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Validate UUID
    if (!z.string().uuid().safeParse(deliveryId).success) {
      return { success: false, error: 'Invalid deliveryId' };
    }

    // Import upload function
    const { uploadPODImage } = await import('@/utils/supabase/storage');

    // Upload file to storage
    const uploadResult = await uploadPODImage(file, deliveryId);

    if (uploadResult.error || !uploadResult.url) {
      return {
        success: false,
        error: uploadResult.error || 'Upload failed - no URL returned'
      };
    }

    // Update delivery record with proof URL (using actual DB columns)
    await prisma.$executeRawUnsafe(`
      UPDATE deliveries
      SET
        delivery_photo_url = $2,
        delivery_notes = COALESCE(delivery_notes, '') || $3,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      deliveryId,
      uploadResult.url,
      description ? ` [POD: ${description} at ${new Date().toISOString()}]` : ''
    );

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');

    return { success: true, url: uploadResult.url };
  } catch (error) {
    console.error('Error uploading proof of delivery:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload proof'
    };
  }
}

/**
 * Get delivery history for a driver
 */
export async function getDriverDeliveryHistory(
  driverId: string,
  limit: number = 20
): Promise<DeliveryTracking[]> {
  try {
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        d.id,
        d.driver_id,
        d.status,
        ST_AsGeoJSON(d.pickup_location) as pickup_location_geojson,
        ST_AsGeoJSON(d.delivery_location) as delivery_location_geojson,
        d.estimated_delivery_time,
        d.delivered_at,
        d.delivery_photo_url,
        d.delivery_notes,
        d.assigned_at,
        d.arrived_at_vendor_at,
        d.picked_up_at,
        d.en_route_at,
        d.arrived_at_client_at,
        d.created_at,
        d.updated_at
      FROM deliveries d
      WHERE d.driver_id = $1::uuid
      AND d.deleted_at IS NULL
      ORDER BY d.assigned_at DESC
      LIMIT $2::int
    `, driverId, limit);

    return result.map(delivery => ({
      id: delivery.id,
      cateringRequestId: undefined, // Column doesn't exist in schema
      onDemandId: undefined, // Column doesn't exist in schema
      driverId: delivery.driver_id,
      status: delivery.status,
      pickupLocation: delivery.pickup_location_geojson ?
        JSON.parse(delivery.pickup_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      deliveryLocation: delivery.delivery_location_geojson ?
        JSON.parse(delivery.delivery_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      estimatedArrival: delivery.estimated_delivery_time,
      actualArrival: delivery.delivered_at,
      route: [], // Route points loaded separately if needed
      proofOfDelivery: delivery.delivery_photo_url,
      actualDistanceMiles: undefined, // Column doesn't exist in schema
      routePolyline: undefined, // Column doesn't exist in schema
      metadata: delivery.delivery_notes ? { notes: delivery.delivery_notes } : {},
      assignedAt: delivery.assigned_at,
      arrivedAtVendorAt: delivery.arrived_at_vendor_at,
      startedAt: delivery.picked_up_at,
      enRouteAt: delivery.en_route_at,
      arrivedAt: delivery.arrived_at_client_at,
      completedAt: delivery.delivered_at,
      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at
    }));
  } catch (error) {
    console.error('Error getting driver delivery history:', error);
    return [];
  }
}