'use server';

import { prisma } from '@/utils/prismaDB';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/auth-middleware';
import type { LocationUpdate, DriverShift, ShiftBreak } from '@/types/tracking';
import {
  locationRateLimiter,
  RateLimitExceededError
} from '@/lib/rate-limiting/location-rate-limiter';
import {
  driverMetadataCache,
  type DriverMetadata
} from '@/lib/cache/driver-metadata-cache';
import { realtimeLogger } from '@/lib/logging/realtime-logger';
import { staleLocationDetector } from '@/lib/realtime/stale-detection';
import {
  calculateShiftMileage,
  calculateShiftMileageWithBreakdown,
  calculateShiftMileageWithValidation,
} from '@/services/tracking/mileage';

/**
 * Start a new driver shift
 * Creates a new shift record and updates driver status
 */
export async function startDriverShift(
  driverId: string,
  startLocation: LocationUpdate,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; shiftId?: string; error?: string }> {
  try {
    // Use raw SQL for PostGIS operations since Prisma doesn't support geography types well
    const result = await prisma.$executeRawUnsafe(`
      INSERT INTO driver_shifts (
        driver_id,
        start_time,
        start_location,
        status,
        metadata
      ) VALUES (
        $1::uuid,
        NOW(),
        ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        'active',
        $4::jsonb
      ) RETURNING id
    `,
      driverId,
      startLocation.coordinates.lng,
      startLocation.coordinates.lat,
      JSON.stringify(metadata)
    );

    // Update driver status
    await prisma.$executeRawUnsafe(`
      UPDATE drivers
      SET
        is_on_duty = true,
        current_shift_id = (
          SELECT id FROM driver_shifts
          WHERE driver_id = $1::uuid
          AND status = 'active'
          ORDER BY start_time DESC
          LIMIT 1
        ),
        shift_start_time = NOW(),
        last_known_location = ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      driverId,
      startLocation.coordinates.lng,
      startLocation.coordinates.lat
    );

    // Get the created shift ID
    const shiftRecord = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM driver_shifts 
      WHERE driver_id = $1::uuid 
      AND status = 'active' 
      ORDER BY start_time DESC 
      LIMIT 1
    `, driverId);

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');

    return {
      success: true,
      shiftId: shiftRecord[0]?.id
    };
  } catch (error) {
    console.error('Error starting driver shift:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start shift'
    };
  }
}

/**
 * End the current driver shift
 * Updates shift record with end time and location, calculates total distance
 */
export async function endDriverShift(
  shiftId: string,
  endLocation: LocationUpdate,
  finalMileage?: number,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get shift info and ensure it is active before proceeding
    const shiftInfo = await prisma.$queryRawUnsafe<{
      driver_id: string;
      status: string;
    }[]>(`
      SELECT 
        driver_id,
        status
      FROM driver_shifts 
      WHERE id = $1::uuid
    `, shiftId);

    if (shiftInfo.length === 0 || (shiftInfo[0]?.status !== 'active' && shiftInfo[0]?.status !== 'paused')) {
      return { success: false, error: 'Active shift not found' };
    }

    const shift = shiftInfo[0];

    // Always record the end location in the database first so that the
    // mileage calculation window has a proper closing point.
    await prisma.$executeRawUnsafe(`
      UPDATE driver_shifts
      SET
        end_time = NOW(),
        end_location = ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        status = 'completed',
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      shiftId,
      endLocation.coordinates.lng,
      endLocation.coordinates.lat,
      JSON.stringify({
        ...metadata,
        // Preserve any caller-provided finalMileage but treat it as an
        // informational override rather than the canonical distance.
        clientReportedMileageKm: finalMileage ?? undefined,
      })
    );

    // Calculate mileage from GPS trail. If finalMileage is provided (e.g., odometer reading),
    // use validation to compare GPS vs reported values and log discrepancies.
    let totalMiles = finalMileage ?? 0;

    try {
      if (finalMileage == null) {
        // Pure GPS-based calculation
        const result = await calculateShiftMileage(shiftId);
        totalMiles = result.totalMiles;
      } else {
        // Client provided mileage - validate against GPS and store both for audit
        const result = await calculateShiftMileageWithValidation(shiftId, finalMileage);
        totalMiles = result.totalMiles;

        // Log any warnings from the calculation
        if (result.warnings.length > 0) {
          realtimeLogger.warn('Mileage calculation warnings', {
            driverId: shift?.driver_id,
            metadata: {
              shiftId,
              warnings: result.warnings,
              discrepancyPercent: result.discrepancyPercent,
            },
          });
        }
      }
    } catch (error) {
      const calculationError = error instanceof Error ? error : new Error('Unknown mileage calculation error');
      realtimeLogger.error('Failed to calculate shift mileage from GPS trail', {
        driverId: shift?.driver_id,
        error: calculationError,
        metadata: {
          shiftId,
        },
      });
    }

    // Safety net: ensure mileage is persisted even if service had partial failure
    if (Number.isFinite(totalMiles) && totalMiles > 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE driver_shifts
        SET
          total_distance_miles = COALESCE(total_distance_miles, $2::float),
          updated_at = NOW()
        WHERE id = $1::uuid
          AND total_distance_miles IS NULL
      `,
      shiftId,
      totalMiles);
    }

    // Update driver status
    await prisma.$executeRawUnsafe(`
      UPDATE drivers
      SET
        is_on_duty = false,
        current_shift_id = NULL,
        shift_start_time = NULL,
        last_known_location = ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      shift?.driver_id,
      endLocation.coordinates.lng,
      endLocation.coordinates.lat
    );

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');

    return { success: true };
  } catch (error) {
    console.error('Error ending driver shift:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end shift'
    };
  }
}

/**
 * Start a break during an active shift
 */
export async function startShiftBreak(
  shiftId: string,
  breakType: 'rest' | 'meal' | 'fuel' | 'emergency' = 'rest',
  location?: LocationUpdate
): Promise<{ success: boolean; breakId?: string; error?: string }> {
  try {
    // Verify shift exists and is active
    const shiftExists = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM driver_shifts 
      WHERE id = $1::uuid AND status = 'active'
    `, shiftId);

    if (shiftExists.length === 0) {
      return { success: false, error: 'Active shift not found' };
    }

    // Insert break record
    if (location) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO shift_breaks (
          shift_id,
          start_time,
          break_type,
          location
        ) VALUES (
          $1::uuid,
          NOW(),
          $2,
          ST_SetSRID(ST_MakePoint($3::float, $4::float), 4326)::geography
        )
      `,
        shiftId,
        breakType,
        location.coordinates.lng,
        location.coordinates.lat
      );
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO shift_breaks (
          shift_id,
          start_time,
          break_type,
          location
        ) VALUES (
          $1::uuid,
          NOW(),
          $2,
          NULL
        )
      `,
        shiftId,
        breakType
      );
    }

    // Update shift status to paused
    await prisma.$executeRawUnsafe(`
      UPDATE driver_shifts 
      SET status = 'paused', updated_at = NOW()
      WHERE id = $1::uuid
    `, shiftId);

    // Get the created break ID
    const breakRecord = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM shift_breaks 
      WHERE shift_id = $1::uuid 
      AND end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    `, shiftId);

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');

    return {
      success: true,
      breakId: breakRecord[0]?.id
    };
  } catch (error) {
    console.error('Error starting shift break:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start break'
    };
  }
}

/**
 * End the current break and resume shift
 */
export async function endShiftBreak(
  breakId: string,
  location?: LocationUpdate
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get break and shift info
    const breakInfo = await prisma.$queryRawUnsafe<{
      shift_id: string;
      break_type: string;
    }[]>(`
      SELECT shift_id, break_type
      FROM shift_breaks 
      WHERE id = $1::uuid AND end_time IS NULL
    `, breakId);

    if (breakInfo.length === 0) {
      return { success: false, error: 'Active break not found' };
    }

    const break_record = breakInfo[0];
    if (!break_record) {
      return { success: false, error: 'Break record not found' };
    }

    // End the break
    await prisma.$executeRawUnsafe(`
      UPDATE shift_breaks 
      SET end_time = NOW()
      WHERE id = $1::uuid
    `, breakId);

    // Resume the shift (set back to active)
    await prisma.$executeRawUnsafe(`
      UPDATE driver_shifts 
      SET status = 'active', updated_at = NOW()
      WHERE id = $1::uuid
    `, break_record.shift_id);

    revalidatePath('/admin/tracking');
    revalidatePath('/driver');

    return { success: true };
  } catch (error) {
    console.error('Error ending shift break:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end break'
    };
  }
}

/**
 * Get current active shift for a driver
 */
export async function getActiveShift(driverId: string): Promise<DriverShift | null> {
  try {
    // Validate UUID to avoid 22P02 errors
    const uuid = z.string().uuid().safeParse(driverId);
    if (!uuid.success) {
      console.error('getActiveShift called with invalid driverId', { driverId });
      return null;
    }
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ds.id,
        ds.driver_id,
        ds.shift_start as start_time,
        ds.shift_end as end_time,
        ST_AsGeoJSON(ds.start_location) as start_location_geojson,
        ST_AsGeoJSON(ds.end_location) as end_location_geojson,
        ds.total_distance_miles,
        ds.delivery_count,
        ds.status,
        ds.metadata,
        ds.created_at,
        ds.updated_at
      FROM driver_shifts ds
      WHERE ds.driver_id = $1::uuid
      AND ds.status IN ('active', 'paused')
      ORDER BY ds.shift_start DESC
      LIMIT 1
    `, driverId);

    if (result.length === 0) return null;

    const shift = result[0];

    // Get breaks for this shift
    const breaks = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id,
        shift_id,
        start_time,
        end_time,
        break_type,
        ST_AsGeoJSON(location) as location_geojson,
        created_at
      FROM shift_breaks
      WHERE shift_id = $1::uuid
      ORDER BY start_time DESC
    `, shift.id);

    return {
      id: shift.id,
      driverId: shift.driver_id,
      startTime: shift.start_time,
      endTime: shift.end_time,
      startLocation: shift.start_location_geojson ?
        JSON.parse(shift.start_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      endLocation: shift.end_location_geojson ?
        JSON.parse(shift.end_location_geojson).coordinates.reverse() : undefined,
      totalDistanceMiles: shift.total_distance_miles,
      deliveryCount: shift.delivery_count,
      status: shift.status,
      breaks: breaks.map(b => ({
        id: b.id,
        shiftId: b.shift_id,
        startTime: b.start_time,
        endTime: b.end_time,
        breakType: b.break_type,
        location: b.location_geojson ?
          JSON.parse(b.location_geojson).coordinates.reverse() : undefined,
        createdAt: b.created_at
      })),
      metadata: shift.metadata,
      createdAt: shift.created_at,
      updatedAt: shift.updated_at
    };
  } catch (error) {
    console.error('Error getting active shift:', error);
    return null;
  }
}

/**
 * Update driver location during active shift
 * This also creates a location record in driver_locations table
 */
export async function updateDriverLocation(
  driverId: string,
  location: LocationUpdate
): Promise<{ success: boolean; error?: string }>;
export async function updateDriverLocation(
  locations: LocationUpdate[]
): Promise<boolean>;
export async function updateDriverLocation(
  driverIdOrLocations: string | LocationUpdate[],
  location?: LocationUpdate
): Promise<{ success: boolean; error?: string } | boolean> {
  try {
    // Handle array of locations (legacy test interface)
    if (Array.isArray(driverIdOrLocations)) {
      const locations = driverIdOrLocations;
      if (locations.length === 0) {
        return true; // Empty array is valid
      }
      
      // Process each location update
      for (const loc of locations) {
        const result = await updateDriverLocation(loc.driverId, loc);
        if (!result.success) {
          return false;
        }
      }
      return true;
    }

    // Handle single location update (current interface)
    const driverId = driverIdOrLocations;
    if (!location) {
      return { success: false, error: 'Location is required' };
    }

    // Validate UUID
    const uuid = z.string().uuid().safeParse(driverId);
    if (!uuid.success) {
      return { success: false, error: 'Invalid driverId' };
    }

    // Check rate limit atomically (1 update per 5 seconds per driver)
    // SECURITY FIX: Using checkAndRecordLimit() to prevent race conditions
    // This atomically checks AND records, preventing concurrent requests from bypassing the limit
    const rateLimit = locationRateLimiter.checkAndRecordLimit(driverId);
    if (!rateLimit.allowed) {
      realtimeLogger.rateLimit(driverId, rateLimit.retryAfter!);
      return {
        success: false,
        error: rateLimit.message
      };
    }

    // Insert location record
    // NOTE: Database trigger (20251107000001_create_driver_locations_table.sql:104-155)
    // automatically broadcasts this location update via Supabase Realtime.
    // No application-level broadcasting needed.
    // NOTE: activity_type column removed as it doesn't exist in database schema
    // Table only has is_moving boolean field for tracking movement state
    await prisma.$executeRawUnsafe(`
      INSERT INTO driver_locations (
        driver_id,
        location,
        accuracy,
        speed,
        heading,
        altitude,
        battery_level,
        is_moving,
        recorded_at
      ) VALUES (
        $1::uuid,
        ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        $4::float,
        $5::float,
        $6::float,
        $7::float,
        $8::float,
        $9::boolean,
        $10::timestamptz
      )
    `,
      driverId,
      location.coordinates.lng,
      location.coordinates.lat,
      location.accuracy,
      location.speed,
      location.heading,
      location.altitude,
      location.batteryLevel,
      location.isMoving,
      location.timestamp
    );

    // Update driver's last known location
    await prisma.$executeRawUnsafe(`
      UPDATE drivers
      SET
        last_known_location = ST_SetSRID(ST_MakePoint($2::float, $3::float), 4326)::geography,
        last_location_update = NOW(),
        updated_at = NOW()
      WHERE id = $1::uuid
    `,
      driverId,
      location.coordinates.lng,
      location.coordinates.lat
    );

    // NOTE: Rate limit was already recorded atomically by checkAndRecordLimit()
    // No need to call recordUpdate() here - doing so would be redundant and incorrect

    // Track location for stale detection (helps identify drivers who haven't sent updates in 5+ minutes)
    staleLocationDetector.recordLocation(
      driverId,
      location.coordinates.lat,
      location.coordinates.lng
    );

    return { success: true };
  } catch (error) {
    // Safe access to variables depending on code path (array vs single update)
    const errorDriverId = typeof driverIdOrLocations === 'string'
      ? driverIdOrLocations
      : 'batch-update';

    realtimeLogger.error('Failed to update driver location', {
      driverId: errorDriverId,
      error,
      metadata: location ? {
        coordinates: location.coordinates,
        timestamp: location.timestamp.toISOString()
      } : undefined
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update location'
    };
  }
}

/**
 * Pause a driver shift (without specifying break type)
 * This is a convenience function that starts a 'rest' break
 */
export async function pauseShift(
  shiftId: string,
  location?: LocationUpdate
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await startShiftBreak(shiftId, 'rest', location);
    return result;
  } catch (error) {
    console.error('Error pausing shift:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause shift'
    };
  }
}

export async function getDriverShiftHistory(
  driverId: string,
  limit: number = 10
): Promise<DriverShift[]> {
  try {
    const uuid = z.string().uuid().safeParse(driverId);
    if (!uuid.success) {
      return [];
    }
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        ds.id,
        ds.driver_id,
        ds.shift_start as start_time,
        ds.shift_end as end_time,
        ST_AsGeoJSON(ds.start_location) as start_location_geojson,
        ST_AsGeoJSON(ds.end_location) as end_location_geojson,
        ds.total_distance_miles,
        ds.delivery_count,
        ds.status,
        ds.metadata,
        ds.created_at,
        ds.updated_at
      FROM driver_shifts ds
      WHERE ds.driver_id = $1::uuid
      ORDER BY ds.shift_start DESC
      LIMIT $2::int
    `, driverId, limit);

    return result.map(shift => ({
      id: shift.id,
      driverId: shift.driver_id,
      startTime: shift.start_time,
      endTime: shift.end_time,
      startLocation: shift.start_location_geojson ?
        JSON.parse(shift.start_location_geojson).coordinates.reverse() : { lat: 0, lng: 0 },
      endLocation: shift.end_location_geojson ?
        JSON.parse(shift.end_location_geojson).coordinates.reverse() : undefined,
      totalDistanceMiles: shift.total_distance_miles,
      deliveryCount: shift.delivery_count,
      status: shift.status,
      breaks: [], // Breaks loaded separately if needed
      metadata: shift.metadata,
      createdAt: shift.created_at,
      updatedAt: shift.updated_at
    }));
  } catch (error) {
    console.error('Error getting driver shift history:', error);
    return [];
  }
}

/**
 * NOTE: Location broadcasting is handled automatically by database triggers.
 *
 * See migration: supabase/migrations/20251107000001_create_driver_locations_table.sql:104-155
 * The trigger "trigger_driver_location_updated" automatically broadcasts location updates
 * via Supabase Realtime when a new location is inserted into driver_locations table.
 *
 * This eliminates the need for application-level broadcasting and provides:
 * - Better performance (no channel create/subscribe/unsubscribe overhead)
 * - Reliability (triggers can't be skipped accidentally)
 * - Simplicity (less application code to maintain)
 * - Consistency (all location inserts broadcast, not just via this action)
 */