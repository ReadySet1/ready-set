// app/api/cater-valley/orders/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  UpdateOrderRequest,
  UpdateOrderResponse,
  ErrorResponse,
} from "@/types/catervalley";
import { validateCaterValleyAuth } from "@/lib/catervalley/auth";
import { calculatePricing } from "@/lib/catervalley/pricing";
import { convertLocalToUTC } from "@/lib/catervalley/time";
import { updateDraftOrder, getOrderById } from "@/lib/catervalley/database";

const updateOrderSchema = z.object({
  id: z.string().uuid(),
  orderCode: z.string().min(1),
  deliveryAddress: z
    .object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
    })
    .optional(),
  deliveryTime: z.string().optional(),
  priceTotal: z.number().positive().optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().positive(),
        price: z.number().nonnegative(),
      })
    )
    .optional(),
  headCount: z.number().optional(),
  specialInstructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const authResult = validateCaterValleyAuth(request.headers);
    if (!authResult.valid) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Invalid authentication credentials",
          code: "INVALID_AUTHENTICATION",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validationResult = updateOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Invalid request payload",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
          details: { errors: validationResult.error.errors },
        },
        { status: 400 }
      );
    }

    const updateRequest: UpdateOrderRequest = validationResult.data;

    // 3. Get existing order
    const existingOrder = await getOrderById(updateRequest.id);
    if (!existingOrder) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Order not found",
          code: "ORDER_NOT_FOUND",
          timestamp: new Date().toISOString(),
          details: { id: updateRequest.id },
        },
        { status: 404 }
      );
    }

    // 4. Merge updates with existing order
    const mergedData = {
      priceTotal: updateRequest.priceTotal ?? existingOrder.priceTotal,
      deliveryTime: updateRequest.deliveryTime
        ? updateRequest.deliveryTime
        : existingOrder.deliveryTime.toISOString(),
      headCount: updateRequest.headCount ?? existingOrder.headCount,
      pickupLocation: existingOrder.pickupLocation,
      deliveryAddress:
        updateRequest.deliveryAddress ?? existingOrder.deliveryAddress,
    };

    // 5. Recalculate pricing with updated data
    const pricingResult = await calculatePricing(mergedData);

    if (!pricingResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Failed to calculate pricing",
          code: "PRICING_ERROR",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // 6. Enforce minimum delivery fee
    const finalDeliveryPrice = Math.max(42.5, pricingResult.deliveryPrice);
    const finalTotalPrice = finalDeliveryPrice + mergedData.priceTotal;

    // 7. Convert time if updated
    let estimatedPickupTime = existingOrder.estimatedPickupTime;
    if (updateRequest.deliveryTime) {
      const deliveryTimeUTC = convertLocalToUTC(updateRequest.deliveryTime);
      estimatedPickupTime = new Date(
        deliveryTimeUTC.getTime() - 45 * 60 * 1000
      );
    }

    // 8. Update order in database
    const updatedOrder = await updateDraftOrder(updateRequest.id, {
      deliveryAddress: updateRequest.deliveryAddress,
      deliveryTime: updateRequest.deliveryTime
        ? convertLocalToUTC(updateRequest.deliveryTime)
        : undefined,
      priceTotal: updateRequest.priceTotal,
      deliveryPrice: finalDeliveryPrice,
      totalPrice: finalTotalPrice,
      items: updateRequest.items,
      breakdown: pricingResult.breakdown,
      headCount: updateRequest.headCount,
      specialInstructions: updateRequest.specialInstructions,
      estimatedPickupTime,
    });

    // 9. Return updated pricing
    const response: UpdateOrderResponse = {
      id: updatedOrder.id,
      deliveryPrice: finalDeliveryPrice,
      totalPrice: finalTotalPrice,
      estimatedPickupTime: estimatedPickupTime.toISOString(),
      status: "SUCCESS",
      breakdown: pricingResult.breakdown,
      warnings:
        pricingResult.deliveryPrice < 42.5
          ? ["Minimum delivery fee of $42.50 applied"]
          : undefined,
    };

    console.log("[CaterValley Update]", {
      orderCode: updateRequest.orderCode,
      id: updatedOrder.id,
      deliveryPrice: finalDeliveryPrice,
    });

    return NextResponse.json<UpdateOrderResponse>(response, { status: 200 });
  } catch (error) {
    console.error("[CaterValley Update Error]", error);

    return NextResponse.json<ErrorResponse>(
      {
        error: true,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// app/api/cater-valley/orders/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ConfirmOrderRequest,
  ConfirmOrderResponse,
  ErrorResponse,
} from "@/types/catervalley";
import { validateCaterValleyAuth } from "@/lib/catervalley/auth";
import { confirmOrder, getOrderById } from "@/lib/catervalley/database";
import { generateOrderNumber } from "@/lib/catervalley/utils";

const confirmOrderSchema = z.object({
  id: z.string().uuid(),
  orderCode: z.string().min(1),
  paymentConfirmed: z.boolean().optional(),
  customerNotes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const authResult = validateCaterValleyAuth(request.headers);
    if (!authResult.valid) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Invalid authentication credentials",
          code: "INVALID_AUTHENTICATION",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validationResult = confirmOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Invalid request payload",
          code: "VALIDATION_ERROR",
          timestamp: new Date().toISOString(),
          details: { errors: validationResult.error.errors },
        },
        { status: 400 }
      );
    }

    const confirmRequest: ConfirmOrderRequest = validationResult.data;

    // 3. Get existing draft order
    const existingOrder = await getOrderById(confirmRequest.id);
    if (!existingOrder) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Order not found",
          code: "ORDER_NOT_FOUND",
          timestamp: new Date().toISOString(),
          details: { id: confirmRequest.id },
        },
        { status: 404 }
      );
    }

    // 4. Generate ReadySet order number
    const orderNumber = generateOrderNumber(confirmRequest.orderCode);

    // 5. Calculate estimated delivery time
    const estimatedDeliveryTime = new Date(
      existingOrder.deliveryTime.getTime()
    );

    // 6. Calculate expected driver assignment time (15 minutes from now)
    const expectedAssignmentTime = new Date(Date.now() + 15 * 60 * 1000);

    // 7. Confirm order in database
    const confirmedOrder = await confirmOrder(confirmRequest.id, {
      orderNumber,
      status: "CONFIRMED",
      confirmedAt: new Date(),
      estimatedDeliveryTime,
      customerNotes: confirmRequest.customerNotes,
    });

    // 8. Return confirmation response
    const response: ConfirmOrderResponse = {
      id: confirmedOrder.id,
      orderNumber,
      status: "CONFIRMED",
      message: "Order has been confirmed and is ready for dispatch",
      estimatedDeliveryTime: estimatedDeliveryTime.toISOString(),
      driverAssignment: {
        expectedAssignmentTime: expectedAssignmentTime.toISOString(),
        trackingAvailable: true,
      },
    };

    console.log("[CaterValley Confirm]", {
      orderCode: confirmRequest.orderCode,
      id: confirmedOrder.id,
      orderNumber,
    });

    // TODO: Trigger driver assignment workflow
    // TODO: Send notification to operations team

    return NextResponse.json<ConfirmOrderResponse>(response, { status: 200 });
  } catch (error) {
    console.error("[CaterValley Confirm Error]", error);

    return NextResponse.json<ErrorResponse>(
      {
        error: true,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// app/api/cater-valley/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { StatusResponse } from "@/types/catervalley";
import { checkDatabaseConnection } from "@/lib/catervalley/database";

export async function GET(request: NextRequest) {
  try {
    const dbStatus = await checkDatabaseConnection();

    const response: StatusResponse = {
      status: dbStatus ? "operational" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
      uptime: process.uptime(),
      services: {
        database: dbStatus ? "connected" : "disconnected",
        webhook: "operational",
      },
    };

    return NextResponse.json<StatusResponse>(response, { status: 200 });
  } catch (error) {
    console.error("[CaterValley Status Error]", error);

    const response: StatusResponse = {
      status: "down",
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json<StatusResponse>(response, { status: 503 });
  }
}
