/**
 * ezCater Events API Route
 *
 * POST /api/ezcater/events - Report a courier event to ezCater
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { courierEventService } from '@/services/ezcater';
import { prisma } from '@/utils/prismaDB';
import { z } from 'zod';
import type { EzCaterCourierEventType } from '@/types/ezcater';

// Validation schema for event request
const eventRequestSchema = z.object({
  deliveryId: z.string().min(1, 'deliveryId is required'),
  eventType: z.enum([
    'COURIER_ASSIGNED',
    'EN_ROUTE_TO_PICKUP',
    'ARRIVED_AT_PICKUP',
    'ORDER_PICKED_UP',
    'EN_ROUTE_TO_DROPOFF',
    'ARRIVED_AT_DROPOFF',
    'ORDER_DELIVERED',
  ] as const),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

/**
 * POST /api/ezcater/events
 *
 * Report a courier event to ezCater.
 * Requires DRIVER, ADMIN, or SUPER_ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    const user = authResult.context.user;

    // Parse and validate request body
    const body = await request.json();
    const validationResult = eventRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { deliveryId, eventType, coordinates } = validationResult.data;

    // Get driver info for the courier object
    let driverInfo;

    if (user.type === 'DRIVER') {
      // Get the driver's profile info
      const driver = await prisma.driver.findFirst({
        where: {
          profileId: user.id,
          deletedAt: null,
        },
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              contactNumber: true,
            },
          },
        },
      });

      if (!driver) {
        return NextResponse.json(
          { success: false, error: 'Driver profile not found' },
          { status: 404 }
        );
      }

      // Parse name into first/last
      const nameParts = (driver.profile?.name || '').split(' ');
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(' ') || undefined;

      driverInfo = {
        id: driver.id,
        firstName,
        lastName,
        phone: driver.phoneNumber || driver.profile?.contactNumber || undefined,
      };
    } else {
      // Admin is reporting on behalf of a driver - require driverId in request
      const { driverId } = body;

      if (!driverId) {
        return NextResponse.json(
          {
            success: false,
            error: 'driverId is required when reporting as admin',
          },
          { status: 400 }
        );
      }

      const driver = await prisma.driver.findFirst({
        where: {
          id: driverId,
          deletedAt: null,
        },
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              contactNumber: true,
            },
          },
        },
      });

      if (!driver) {
        return NextResponse.json(
          { success: false, error: 'Driver not found' },
          { status: 404 }
        );
      }

      const nameParts = (driver.profile?.name || '').split(' ');
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.slice(1).join(' ') || undefined;

      driverInfo = {
        id: driver.id,
        firstName,
        lastName,
        phone: driver.phoneNumber || driver.profile?.contactNumber || undefined,
      };
    }

    // Report the event
    const result = await courierEventService.reportEvent({
      deliveryId,
      eventType: eventType as EzCaterCourierEventType,
      driver: driverInfo,
      coordinates,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to report event',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        deliveryId: result.deliveryId,
        eventType: result.eventType,
      },
    });
  } catch (error) {
    console.error('[ezCater Events API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
