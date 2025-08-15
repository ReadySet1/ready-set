import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";

type CateringRequest = any;
type OnDemandOrder = any;
type Order =
  | (CateringRequest & { order_type: "catering" })
  | (OnDemandOrder & { order_type: "on_demand" });

function serializeBigInt(data: any): any {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value === null ? null : value,
    ),
  );
}

// Normalize Prisma order shape to the client-facing snake_case structure
function normalizeOrderForClient(order: Order) {
  const isCatering = order.order_type === "catering";

  const driverStatus = (order as any).driverStatus
    ? String((order as any).driverStatus).toLowerCase()
    : null;

  const normalized = {
    id: order.id,
    order_number: (order as any).orderNumber,
    order_type: order.order_type,
    date: (order as any).pickupDateTime ?? (order as any).createdAt ?? null,
    status: String((order as any).status).toLowerCase(),
    driver_status: driverStatus,
    order_total: ((order as any).orderTotal ?? 0).toString(),
    special_notes: (order as any).specialNotes ?? null,
    address: order.pickupAddress
      ? {
          street1: order.pickupAddress.street1 ?? null,
          city: order.pickupAddress.city ?? null,
          state: order.pickupAddress.state ?? null,
          zip: (order.pickupAddress as any).zip ?? null,
        }
      : null,
    delivery_address: order.deliveryAddress
      ? {
          street1: order.deliveryAddress.street1 ?? null,
          city: order.deliveryAddress.city ?? null,
          state: order.deliveryAddress.state ?? null,
          zip: (order.deliveryAddress as any).zip ?? null,
        }
      : null,
    dispatch: Array.isArray((order as any).dispatches)
      ? (order as any).dispatches.map((d: any) => ({
          driver: d?.driver
            ? {
                id: d.driver.id,
                name: d.driver.name ?? null,
                email: d.driver.email ?? null,
                contact_number: d.driver.contactNumber ?? null,
              }
            : null,
        }))
      : [],
    user_id: (order as any).userId,
    pickup_time: (order as any).pickupDateTime ?? null,
    arrival_time: (order as any).arrivalDateTime ?? null,
    complete_time: (order as any).completeDateTime ?? null,
    updated_at: (order as any).updatedAt ?? null,
    ...(isCatering ? { headcount: (order as any).headcount ?? null } : {}),
  };

  return serializeBigInt(normalized);
}

export async function GET(req: NextRequest, props: { params: Promise<{ order_number: string }> }) {
  const params = await props.params;
  try {
    // Create Supabase client
    const supabase = await createClient();
    
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();

    // Check authentication
    if (!user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { order_number: encodedOrderNumber } = params;
    const order_number = decodeURIComponent(encodedOrderNumber);

    let order: Order | null = null;

    // Try to find catering request
    const cateringRequest = await prisma.cateringRequest.findUnique({
      where: { orderNumber: order_number },
      include: {
        user: { select: { name: true, email: true } },
        pickupAddress: true,
        deliveryAddress: true,
        dispatches: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          },
        },
      },
    });

    if (cateringRequest) {
      order = {
        ...cateringRequest,
        order_type: "catering",
      };
    } else {
      // If not found, try to find on-demand order
      const onDemandOrder = await prisma.onDemand.findUnique({
        where: { orderNumber: order_number },
        include: {
          user: { select: { name: true, email: true } },
          pickupAddress: true,
          deliveryAddress: true,
          dispatches: {
            include: {
              driver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  contactNumber: true,
                },
              },
            },
          },
        },
      });

      if (onDemandOrder) {
        order = { ...onDemandOrder, order_type: "on_demand" };
      }
    }

    if (order) {
      const normalized = normalizeOrderForClient(order);
      return NextResponse.json(normalized);
    }

    return NextResponse.json({ message: "Order not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { message: "Error fetching order", error: (error as Error).message },
      { status: 500 },
    );
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}