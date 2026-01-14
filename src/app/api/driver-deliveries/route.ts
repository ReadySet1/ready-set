import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import { CONSTANTS } from "@/constants";

import { CateringRequestGetPayload, OnDemandGetPayload } from '@/types/prisma';

type CateringDelivery = CateringRequestGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
    fileUploads: {
      where: { category: 'proof_of_delivery' };
      select: { id: true; fileUrl: true; category: true; uploadedAt: true };
    };
  };
}>;

type OnDemandDelivery = OnDemandGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
    fileUploads: {
      where: { category: 'proof_of_delivery' };
      select: { id: true; fileUrl: true; category: true; uploadedAt: true };
    };
  };
}>;

type Delivery = (CateringDelivery | OnDemandDelivery) & {
  delivery_type: "catering" | "on_demand";
};

export async function GET(req: NextRequest) {
  // Create a Supabase client for server-side authentication
  const supabase = await createClient();

  // Get the user session from Supabase
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const skip = (page - 1) * limit;

  // Parse historical days limit (default: 30 days)
  const historicalDays = parseInt(
    url.searchParams.get("historicalDays") ||
    String(CONSTANTS.DRIVER_HISTORICAL_DAYS_LIMIT),
    10
  );

  // Calculate the cutoff date for historical data
  const historicalCutoffDate = new Date();
  historicalCutoffDate.setDate(historicalCutoffDate.getDate() - historicalDays);
  historicalCutoffDate.setHours(0, 0, 0, 0);

  try {
    // Fetch dispatches for the current driver
    const driverDispatches = await prisma.dispatch.findMany({
      where: {
        driverId: user.id,
      },
      select: {
        cateringRequestId: true,
        onDemandId: true,
      },
    });

    // Separate catering and on-demand IDs
    const cateringIds = driverDispatches
      .filter((d: any) => d.cateringRequestId !== null)
      .map((d: any) => d.cateringRequestId!);
    const onDemandIds = driverDispatches
      .filter((d: any) => d.onDemandId !== null)
      .map((d: any) => d.onDemandId!);

    // If no dispatches, short-circuit to avoid extra queries
    if (cateringIds.length === 0 && onDemandIds.length === 0) {
      return NextResponse.json({
        deliveries: [],
        metadata: {
          historicalDaysLimit: historicalDays,
          cutoffDate: historicalCutoffDate.toISOString(),
        },
      }, { status: 200 });
    }

    // Fetch catering deliveries with historical limit
    // Filter: include incomplete deliveries OR recent completed deliveries
    const cateringDeliveries = await prisma.cateringRequest.findMany({
      where: {
        id: { in: cateringIds },
        OR: [
          { completeDateTime: null }, // Include incomplete deliveries regardless of age
          { createdAt: { gte: historicalCutoffDate } }, // Include recent completed deliveries
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
        fileUploads: {
          where: { category: 'proof_of_delivery' },
          select: { id: true, fileUrl: true, category: true, uploadedAt: true },
        },
      },
    });

    // Fetch on-demand deliveries with historical limit
    // Filter: include incomplete deliveries OR recent completed deliveries
    const onDemandDeliveries = await prisma.onDemand.findMany({
      where: {
        id: { in: onDemandIds },
        OR: [
          { completeDateTime: null }, // Include incomplete deliveries regardless of age
          { createdAt: { gte: historicalCutoffDate } }, // Include recent completed deliveries
        ],
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
        fileUploads: {
          where: { category: 'proof_of_delivery' },
          select: { id: true, fileUrl: true, category: true, uploadedAt: true },
        },
      },
    });

    // Fetch delivery addresses for on-demand deliveries
    const onDemandDeliveryAddresses = await prisma.address.findMany({
      where: {
        id: { in: onDemandDeliveries.map((d: any) => d.deliveryAddressId) },
      },
    });

    // Combine and sort deliveries
    const allDeliveries: Delivery[] = [
      ...cateringDeliveries.map((d: any) => ({
        ...d,
        delivery_type: "catering" as const,
        user: d.user,
        address: d.pickupAddress,
        delivery_address: d.deliveryAddress,
      })),
      ...onDemandDeliveries.map((d: any) => {
        const deliveryAddress = onDemandDeliveryAddresses.find(
          (addr: any) => addr.id === d.deliveryAddressId,
        );
        return {
          ...d,
          delivery_type: "on_demand" as const,
          user: d.user,
          address: d.pickupAddress,
          delivery_address: deliveryAddress,
        };
      }),
    ]
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + limit);

    const serializedDeliveries = allDeliveries.map((delivery) => ({
      ...JSON.parse(
        JSON.stringify(delivery, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      ),
    }));

    // Return deliveries with metadata about the historical limit applied
    return NextResponse.json({
      deliveries: serializedDeliveries,
      metadata: {
        historicalDaysLimit: historicalDays,
        cutoffDate: historicalCutoffDate.toISOString(),
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching driver deliveries:", error);
    return NextResponse.json(
      { message: "Error fetching driver deliveries" },
      { status: 500 },
    );
  }
}