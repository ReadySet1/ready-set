import { NextResponse } from "next/server";
import { prisma } from "@/utils/prismaDB";
import { Prisma } from "@prisma/client";
// Decimal class is now under Prisma namespace in Prisma 7
import { createClient } from "@/utils/supabase/server";
import { validateUserNotSoftDeleted, getActiveDriversForDispatch } from "@/lib/soft-delete-handlers";
import { CateringStatus, DriverStatus as DriverStatusEnum } from "@/types/user";
import {
  transitionOrder,
  StateTransitionError,
} from "@/lib/state-machine/transition";
import type { OrderStatus, OrderType } from "@/lib/state-machine/transition";

function serializeData(obj: unknown): number | string | Date | Record<string, unknown> | unknown {
  if (typeof obj === "bigint") {
    return Number(obj);
  } else if (obj instanceof Date) {
    return obj.toISOString();
  } else if (typeof obj === 'object' && obj !== null && 'toNumber' in obj && typeof (obj as { toNumber: unknown }).toNumber === 'function') {
    return (obj as { toNumber: () => number }).toNumber();
  } else if (Array.isArray(obj)) {
    return obj.map(serializeData);
  } else if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        serializeData(value),
      ]),
    );
  }
  return obj;
}

export async function POST(request: Request) {
  try {
    // Initialize Supabase client for auth check
    const supabase = await createClient();
    
    // Get user session from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // Check if user is authenticated
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    
    const body = await request.json();
        
    const { orderId, driverId, orderType } = body;

    if (!orderId || !driverId || !orderType) {
      console.error("Missing required fields:", { orderId, driverId, orderType });
      return NextResponse.json(
        { error: `Missing required fields: ${!orderId ? 'orderId' : ''} ${!driverId ? 'driverId' : ''} ${!orderType ? 'orderType' : ''}`.trim() },
        { status: 400 },
      );
    }

    // Validate that the driver is not soft-deleted
    const driverValidation = await validateUserNotSoftDeleted(driverId);
    if (!driverValidation.isValid) {
      console.error("Driver validation failed:", driverValidation.error);
      return NextResponse.json(
        { error: driverValidation.error },
        { status: 403 }
      );
    }

    try {
      const result = await prisma.$transaction(async (prisma: any) => {
        let order;
        let dispatch;

        
        // Fetch the order based on orderType
        if (orderType === "catering") {
          order = await prisma.cateringRequest.findUnique({
            where: { id: String(orderId) },
          });
        } else if (orderType === "on_demand") {
          order = await prisma.onDemand.findUnique({
            where: { id: String(orderId) },
          });
        } else {
          throw new Error("Invalid order type");
        }

        if (!order) {
          throw new Error(`${orderType} order not found`);
        }


        // Check if a dispatch already exists
        dispatch = await prisma.dispatch.findFirst({
          where: orderType === "catering"
            ? { cateringRequestId: String(orderId) }
            : { onDemandId: String(orderId) },
        });


        if (dispatch) {
          // Update existing dispatch
          dispatch = await prisma.dispatch.update({
            where: { id: dispatch.id },
            data: { driverId: driverId },
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
          });
        } else {
          // Create new dispatch
          const dispatchData = {
            driverId: driverId,
            userId: order.userId,
            ...(orderType === "catering"
              ? { cateringRequestId: String(orderId) }
              : { onDemandId: String(orderId) }),
          };

          dispatch = await prisma.dispatch.create({
            data: dispatchData,
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
          });
        }

        // Update the order status via the state machine — composes with the
        // ambient $transaction by passing the tx client through.
        let updatedOrder;
        try {
          await transitionOrder(
            {
              orderType: orderType as OrderType,
              orderId: String(orderId),
              currentStatus: (order.status as OrderStatus) ?? null,
              currentDriverStatus: (order.driverStatus as DriverStatusEnum | null) ?? null,
              nextOrderStatus: CateringStatus.ASSIGNED,
            },
            prisma,
          );
          updatedOrder = await (orderType === "catering"
            ? prisma.cateringRequest.findUniqueOrThrow({ where: { id: String(orderId) } })
            : prisma.onDemand.findUniqueOrThrow({ where: { id: String(orderId) } }));
        } catch (err) {
          if (err instanceof StateTransitionError) {
            throw new Error(
              `Cannot assign driver: order status ${order.status} cannot transition to ASSIGNED`,
            );
          }
          throw err;
        }

        return { updatedOrder, dispatch };
      });

      // Serialize the result before sending the response
      const serializedResult = serializeData(result);
      return NextResponse.json(serializedResult);
    } catch (error: any) {
      if (error?.code && error?.message) {
        console.error("Prisma Error:", error.message);
        console.error("Error Code:", error.code);
        console.error("Meta:", error.meta);
        return NextResponse.json(
          { error: `Database error: ${error.message}` },
          { status: 500 },
        );
      } else if (error instanceof Error) {
        console.error("Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      console.error("Unknown error:", error);
      return NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Unknown error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}