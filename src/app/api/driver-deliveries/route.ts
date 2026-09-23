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

    // Catering and on-demand deliveries are independent lookups: issue them
    // together (the database is ~150 ms from the app server).
    // Fetch catering deliveries with historical limit
    // Filter: include incomplete deliveries OR recent completed deliveries
    const cateringLookup = prisma.cateringRequest.findMany({
      where: {
        id: { in: cateringIds },
        OR: [
          { completeDateTime: null },
          { createdAt: { gte: historicalCutoffDate } },
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
    const onDemandLookup = prisma.onDemand.findMany({
      where: {
        id: { in: onDemandIds },
        OR: [
          { completeDateTime: null },
          { createdAt: { gte: historicalCutoffDate } },
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

    const [cateringDeliveries, onDemandDeliveries] = await Promise.all([
      cateringLookup,
      onDemandLookup,
    ]);

    // Combine and sort deliveries
    const allDeliveries: Delivery[] = [
      ...cateringDeliveries.map((d: any) => ({
        ...d,
        delivery_type: "catering" as const,
        user: d.user,
        address: d.pickupAddress,
        delivery_address: d.deliveryAddress,
      })),
      ...onDemandDeliveries.map((d: any) => ({
        ...d,
        delivery_type: "on_demand" as const,
        user: d.user,
        address: d.pickupAddress,
        // Included above (required FK on deliveryAddressId); no second query.
        delivery_address: d.deliveryAddress,
      })),
    ]
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + limit);

    // Batch-fetch delivery stage timestamps for all orders
    const orderNumbers = allDeliveries
      .map((d: any) => d.orderNumber)
      .filter(Boolean) as string[];

    // Stage timestamps and pending return requests are independent reads
    // (both non-fatal): issue them together.
    const orderIds = allDeliveries.map((d: any) => d.id).filter(Boolean) as string[];

    const loadTimestamps = async (): Promise<Record<string, any>> => {
      const map: Record<string, any> = {};
      if (orderNumbers.length === 0) return map;
      try {
        const deliveryRecords = await prisma.delivery.findMany({
          where: { orderNumber: { in: orderNumbers } },
          select: {
            orderNumber: true,
            assignedAt: true,
            enRouteToVendorAt: true,
            arrivedAtVendorAt: true,
            pickedUpAt: true,
            enRouteAt: true,
            arrivedAtClientAt: true,
            deliveredAt: true,
          },
        });

        const toISO = (d: Date | null) => d?.toISOString() ?? null;
        for (const rec of deliveryRecords) {
          if (rec.orderNumber) {
            map[rec.orderNumber] = {
              assignedAt: toISO(rec.assignedAt),
              enRouteToVendorAt: toISO(rec.enRouteToVendorAt),
              arrivedAtVendorAt: toISO(rec.arrivedAtVendorAt),
              pickedUpAt: toISO(rec.pickedUpAt),
              enRouteAt: toISO(rec.enRouteAt),
              arrivedAtClientAt: toISO(rec.arrivedAtClientAt),
              deliveredAt: toISO(rec.deliveredAt),
            };
          }
        }
      } catch (deliveryError) {
        console.warn('Failed to fetch delivery timestamps for driver deliveries:', deliveryError);
      }
      return map;
    };

    // Flag orders with a PENDING driver return request so the driver portal
    // can mirror the server-side end-shift guard (a pending request stops the
    // order from blocking) and show the "Return requested" state.
    const loadPendingReturns = async (): Promise<Set<string>> => {
      if (orderIds.length === 0) return new Set<string>();
      try {
        const pendingRequests = await prisma.deliveryReturnRequest.findMany({
          where: { orderId: { in: orderIds }, status: 'PENDING' },
          select: { orderId: true },
        });
        return new Set(pendingRequests.map((r) => r.orderId));
      } catch (pendingErr) {
        console.warn('Failed to fetch pending return requests for driver deliveries:', pendingErr);
        return new Set<string>();
      }
    };

    const [deliveryTimestampsMap, pendingReturnOrderIds] = await Promise.all([
      loadTimestamps(),
      loadPendingReturns(),
    ]);

    const serializedDeliveries = allDeliveries.map((delivery) => {
      const serialized = JSON.parse(
        JSON.stringify(delivery, (key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
      const orderNum = (delivery as any).orderNumber;
      if (orderNum && deliveryTimestampsMap[orderNum]) {
        serialized.deliveryTimestamps = deliveryTimestampsMap[orderNum];
      }
      serialized.pendingReturn = pendingReturnOrderIds.has((delivery as any).id);
      return serialized;
    });

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