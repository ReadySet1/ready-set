// app/api/cater-valley/orders/draft/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DraftOrderRequest,
  DraftOrderResponse,
  ErrorResponse,
} from "@/types/catervalley";
import { validateCaterValleyAuth } from "@/lib/catervalley/auth";
import { calculatePricing } from "@/lib/catervalley/pricing";
import { convertLocalToUTC } from "@/lib/catervalley/time";
import { createDraftOrder } from "@/lib/catervalley/database";

// Validation schema
const draftOrderSchema = z.object({
  orderCode: z.string().min(1),
  deliveryAddress: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  pickupLocation: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  deliveryTime: z.string(), // Local time format
  priceTotal: z.number().positive(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().positive(),
      price: z.number().nonnegative(),
    })
  ),
  headCount: z.number().optional(),
  specialInstructions: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication headers
    const authResult = validateCaterValleyAuth(request.headers);
    if (!authResult.valid) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Invalid authentication credentials",
          code: "INVALID_AUTHENTICATION",
          timestamp: new Date().toISOString(),
          details: { reason: authResult.reason },
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = draftOrderSchema.safeParse(body);

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

    const orderRequest: DraftOrderRequest = validationResult.data;

    // 3. Calculate pricing
    const pricingResult = await calculatePricing({
      priceTotal: orderRequest.priceTotal,
      deliveryTime: orderRequest.deliveryTime,
      headCount: orderRequest.headCount,
      pickupLocation: orderRequest.pickupLocation,
      deliveryAddress: orderRequest.deliveryAddress,
    });

    if (!pricingResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          error: true,
          message: "Failed to calculate pricing",
          code: "PRICING_ERROR",
          timestamp: new Date().toISOString(),
          details: { reason: pricingResult.error },
        },
        { status: 500 }
      );
    }

    // 4. CRITICAL: Enforce minimum delivery fee of $42.50
    const finalDeliveryPrice = Math.max(42.5, pricingResult.deliveryPrice);
    const finalTotalPrice = finalDeliveryPrice + orderRequest.priceTotal;

    // 5. Convert delivery time to UTC for pickup time estimation
    const deliveryTimeUTC = convertLocalToUTC(orderRequest.deliveryTime);
    const estimatedPickupTime = new Date(
      deliveryTimeUTC.getTime() - 45 * 60 * 1000
    ); // 45 minutes before delivery

    // 6. Create draft order in database
    const draftOrder = await createDraftOrder({
      orderCode: orderRequest.orderCode,
      deliveryAddress: orderRequest.deliveryAddress,
      pickupLocation: orderRequest.pickupLocation,
      deliveryTime: deliveryTimeUTC,
      estimatedPickupTime,
      priceTotal: orderRequest.priceTotal,
      deliveryPrice: finalDeliveryPrice,
      totalPrice: finalTotalPrice,
      items: orderRequest.items,
      breakdown: pricingResult.breakdown,
      headCount: orderRequest.headCount,
      specialInstructions: orderRequest.specialInstructions,
      status: "DRAFT",
    });

    // 7. Return response with UUID and pricing
    const response: DraftOrderResponse = {
      id: draftOrder.id,
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

    console.log("[CaterValley Draft]", {
      orderCode: orderRequest.orderCode,
      id: draftOrder.id,
      deliveryPrice: finalDeliveryPrice,
      originalPrice: pricingResult.deliveryPrice,
    });

    return NextResponse.json<DraftOrderResponse>(response, { status: 200 });
  } catch (error) {
    console.error("[CaterValley Draft Error]", error);

    return NextResponse.json<ErrorResponse>(
      {
        error: true,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
        details:
          process.env.NODE_ENV === "development"
            ? { error: String(error) }
            : undefined,
      },
      { status: 500 }
    );
  }
}
