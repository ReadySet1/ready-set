/**
 * ezCater Delivery-Specific Events API Route
 *
 * PATCH /api/ezcater/events/[deliveryId] - Update status for a specific delivery
 * GET /api/ezcater/events/[deliveryId] - Get delivery info and last reported events
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { courierEventService, CourierEventService } from '@/services/ezcater';
import { prisma } from '@/utils/prismaDB';
import { z } from 'zod';
import type { DriverStatus } from '@/types/prisma';

// Validation schema for PATCH request
const updateStatusSchema = z.object({
  driverStatus: z.enum([
    'ASSIGNED',
    'ARRIVED_AT_VENDOR',
    'PICKED_UP',
    'EN_ROUTE_TO_CLIENT',
    'ARRIVED_TO_CLIENT',
    'COMPLETED',
  ] as const),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

interface RouteContext {
  params: Promise<{ deliveryId: string }>;
}

/**
 * GET /api/ezcater/events/[deliveryId]
 *
 * Get delivery info for an ezCater order.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { deliveryId } = await context.params;

    const authResult = await withAuth(request, {
      allowedRoles: ['DRIVER', 'ADMIN', 'SUPER_ADMIN'],
      requireAuth: true,
    });

    if (!authResult.success) {
      return authResult.response;
    }

    // Find the catering request with this ezCater delivery ID
    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        ezCaterDeliveryId: deliveryId,
        deletedAt: null,
      },
      include: {
        dispatches: {
          include: {
            driver: {
              include: {
                driverRecord: true,
              },
            },
          },
        },
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (!cateringRequest) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: cateringRequest.id,
        orderNumber: cateringRequest.orderNumber,
        ezCaterDeliveryId: cateringRequest.ezCaterDeliveryId,
        driverStatus: cateringRequest.driverStatus,
        pickupDateTime: cateringRequest.pickupDateTime,
        arrivalDateTime: cateringRequest.arrivalDateTime,
        pickupAddress: {
          street1: cateringRequest.pickupAddress.street1,
          city: cateringRequest.pickupAddress.city,
          state: cateringRequest.pickupAddress.state,
          zip: cateringRequest.pickupAddress.zip,
        },
        deliveryAddress: {
          street1: cateringRequest.deliveryAddress.street1,
          city: cateringRequest.deliveryAddress.city,
          state: cateringRequest.deliveryAddress.state,
          zip: cateringRequest.deliveryAddress.zip,
        },
        driver: cateringRequest.dispatches[0]?.driver
          ? {
              id: cateringRequest.dispatches[0].driver.id,
              name: cateringRequest.dispatches[0].driver.name,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[ezCater Events API] GET Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ezcater/events/[deliveryId]
 *
 * Report a status change for a specific delivery.
 * Maps internal DriverStatus to ezCater event types.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { deliveryId } = await context.params;

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
    const validationResult = updateStatusSchema.safeParse(body);

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

    const { driverStatus, coordinates } = validationResult.data;

    // Check if this status maps to an ezCater event
    if (!CourierEventService.hasEventMapping(driverStatus as DriverStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Status ${driverStatus} does not map to an ezCater event`,
        },
        { status: 400 }
      );
    }

    // Get driver info
    let driverInfo;

    if (user.type === 'DRIVER') {
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
      // Admin - get driver from request or from the order's dispatch
      const { driverId } = body;

      if (driverId) {
        const driver = await prisma.driver.findFirst({
          where: { id: driverId, deletedAt: null },
          include: {
            profile: {
              select: { id: true, name: true, contactNumber: true },
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
        driverInfo = {
          id: driver.id,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          phone:
            driver.phoneNumber || driver.profile?.contactNumber || undefined,
        };
      } else {
        // Try to get driver from the catering request dispatch
        const cateringRequest = await prisma.cateringRequest.findFirst({
          where: { ezCaterDeliveryId: deliveryId, deletedAt: null },
          include: {
            dispatches: {
              include: {
                driver: {
                  include: {
                    driverRecord: {
                      include: {
                        profile: {
                          select: { id: true, name: true, contactNumber: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const dispatch = cateringRequest?.dispatches[0];
        const driverProfile = dispatch?.driver;
        const driverRecord = driverProfile?.driverRecord;

        if (!driverRecord) {
          return NextResponse.json(
            {
              success: false,
              error: 'No driver assigned to this delivery',
            },
            { status: 400 }
          );
        }

        const nameParts = (driverRecord.profile?.name || '').split(' ');
        driverInfo = {
          id: driverRecord.id,
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(' ') || undefined,
          phone:
            driverRecord.phoneNumber ||
            driverRecord.profile?.contactNumber ||
            undefined,
        };
      }
    }

    // Report the status change
    const result = await courierEventService.reportStatusChange(
      deliveryId,
      driverStatus as DriverStatus,
      driverInfo,
      coordinates
    );

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'No ezCater event mapping for this status',
        },
        { status: 400 }
      );
    }

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
        driverStatus,
      },
    });
  } catch (error) {
    console.error('[ezCater Events API] PATCH Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
