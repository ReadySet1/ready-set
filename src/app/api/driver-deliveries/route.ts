import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { createClient } from "@/utils/supabase/server";

const prisma = new PrismaClient();

import { CateringRequestGetPayload, OnDemandGetPayload } from '@/types/prisma';

type CateringDelivery = CateringRequestGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
  };
}>;

type OnDemandDelivery = OnDemandGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    pickupAddress: true;
    deliveryAddress: true;
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

    // Fetch catering deliveries
    const cateringDeliveries = await prisma.cateringRequest.findMany({
      where: {
        id: { in: cateringIds },
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    // Fetch on-demand deliveries
    const onDemandDeliveries = await prisma.onDemand.findMany({
      where: {
        id: { in: onDemandIds },
      },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
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

    return NextResponse.json(serializedDeliveries, { status: 200 });
  } catch (error) {
    console.error("Error fetching driver deliveries:", error);
    return NextResponse.json(
      { message: "Error fetching driver deliveries" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}