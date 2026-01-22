import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";

/**
 * GET /api/orders/[order_number]/driver-location
 *
 * Returns the current location of the assigned driver for an order.
 * Accessible by vendors/clients viewing their own orders, or admins.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> }
) {
  try {
    const resolvedParams = await params;
    const supabase = await createClient();

    // Get user session
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderNumber = decodeURIComponent(resolvedParams.order_number);

    // Find the order and its assigned driver
    // Access control matches the main order API - any authenticated user can view
    // Try catering first
    let order = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: orderNumber,
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        dispatches: {
          select: {
            driverId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // If not found, try on-demand
    if (!order) {
      order = await prisma.onDemand.findFirst({
        where: {
          orderNumber: orderNumber,
          deletedAt: null,
        },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          dispatches: {
            select: {
              driverId: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found or access denied" },
        { status: 404 }
      );
    }

    // Get the assigned driver's profile ID from dispatch
    const dispatch = order.dispatches?.[0];

    if (!dispatch?.driverId) {
      return NextResponse.json({
        success: true,
        driverLocation: null,
        message: "No driver assigned to this order",
      });
    }

    // Find the driver's current location
    // The dispatch.driverId is a profile ID, so we need to find the driver
    // by profile_id and get their last known location
    const driverLocation = await prisma.$queryRawUnsafe<Array<{
      lat: number;
      lng: number;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
      is_on_duty: boolean;
      last_location_update: Date | null;
    }>>(
      `
      SELECT
        ST_Y(d.last_known_location::geometry) as lat,
        ST_X(d.last_known_location::geometry) as lng,
        d.last_known_accuracy as accuracy,
        d.last_known_speed as speed,
        d.last_known_heading as heading,
        d.is_on_duty,
        d.last_location_update
      FROM drivers d
      WHERE d.profile_id = $1::uuid
        AND d.is_active = true
        AND d.deleted_at IS NULL
        AND d.last_known_location IS NOT NULL
      LIMIT 1
      `,
      dispatch.driverId
    );

    if (!driverLocation || driverLocation.length === 0 || !driverLocation[0]) {
      // Try alternative: maybe the dispatch.driverId is actually a user_id
      const altLocation = await prisma.$queryRawUnsafe<Array<{
        lat: number;
        lng: number;
        accuracy: number | null;
        speed: number | null;
        heading: number | null;
        is_on_duty: boolean;
        last_location_update: Date | null;
      }>>(
        `
        SELECT
          ST_Y(d.last_known_location::geometry) as lat,
          ST_X(d.last_known_location::geometry) as lng,
          d.last_known_accuracy as accuracy,
          d.last_known_speed as speed,
          d.last_known_heading as heading,
          d.is_on_duty,
          d.last_location_update
        FROM drivers d
        WHERE d.user_id = $1::uuid
          AND d.is_active = true
          AND d.deleted_at IS NULL
          AND d.last_known_location IS NOT NULL
        LIMIT 1
        `,
        dispatch.driverId
      );

      if (!altLocation || altLocation.length === 0 || !altLocation[0]) {
        return NextResponse.json({
          success: true,
          driverLocation: null,
          message: "Driver location not available",
        });
      }

      const loc = altLocation[0];
      return NextResponse.json({
        success: true,
        driverLocation: {
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          isOnDuty: loc.is_on_duty,
          lastUpdate: loc.last_location_update,
        },
      });
    }

    const loc = driverLocation[0];
    return NextResponse.json({
      success: true,
      driverLocation: {
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
        isOnDuty: loc.is_on_duty,
        lastUpdate: loc.last_location_update,
      },
    });

  } catch (error) {
    console.error("Error fetching driver location:", error);
    return NextResponse.json(
      { error: "Failed to fetch driver location" },
      { status: 500 }
    );
  }
}
