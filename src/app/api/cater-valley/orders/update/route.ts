/**
 * Partner Order API — Update endpoint.
 *
 * Modifies a draft order before confirmation. Same partner identity
 * resolution as /draft. The existing order's owner/prefix is checked
 * against the resolved partner so partner A can't update partner B's
 * orders even with valid credentials.
 *
 * Available at both `/api/cater-valley/orders/update` and
 * `/api/partners/orders/update`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { calculatePickupTime, isDeliveryTimeAvailable } from '@/lib/services/pricingService';
import { enforceBodySizeLimit } from '@/lib/security/body-size-limit';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  readIdempotencyContext,
  replayCachedResponse,
  storeAndReturnResponse,
} from '@/lib/security/idempotency';
import {
  authenticatePartnerRequest,
  ensureAddress,
  buildOrderNumber,
  isOrderEditable,
  isPartnerOrder,
  calculateCaterValleyPricing,
  type PricingCalculationResult,
} from '@/app/api/cater-valley/_lib';

const UpdateOrderSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
  orderCode: z.string().min(1, 'Order code is required'),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  totalItem: z.number().int().min(1, 'At least 1 item required'),
  priceTotal: z.number().min(0, 'Price must be non-negative'),
  pickupLocation: z.object({
    name: z.string().min(1, 'Pickup location name is required'),
    address: z.string().min(1, 'Pickup address is required'),
    city: z.string().min(1, 'Pickup city is required'),
    state: z.string().min(2, 'Pickup state is required'),
    zip: z.string().optional(),
    phone: z.string().optional(),
  }),
  dropOffLocation: z.object({
    name: z.string().min(1, 'Drop-off location name is required'),
    address: z.string().min(1, 'Drop-off address is required'),
    city: z.string().min(1, 'Drop-off city is required'),
    state: z.string().min(2, 'Drop-off state is required'),
    zip: z.string().optional(),
    instructions: z.string().optional(),
    recipient: z.object({
      name: z.string().min(1, 'Recipient name is required'),
      phone: z.string().min(10, 'Valid phone number is required'),
    }),
  }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type UpdateOrderRequest = z.infer<typeof UpdateOrderSchema>;

interface UpdateOrderResponse {
  id: string;
  deliveryPrice: number;
  totalPrice: number;
  estimatedPickupTime: string;
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  breakdown?: {
    basePrice: number;
    mileageFee?: number;
    dailyDriveDiscount?: number;
    bridgeToll?: number;
    peakTimeMultiplier?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const sizeReject = enforceBodySizeLimit(request);
    if (sizeReject) return sizeReject;

    const auth = await authenticatePartnerRequest(request);
    if (!auth.ok) return auth.response;
    const { partner } = auth;

    const rateLimitReject = await enforceRateLimit(partner.slug, 'orders.update');
    if (rateLimitReject) return rateLimitReject;

    const idempotency = readIdempotencyContext(request, partner.slug);
    const replay = await replayCachedResponse(idempotency);
    if (replay) return replay;

    let requestBody: UpdateOrderRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    const validationResult = UpdateOrderSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Validation failed',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // 3. Check if order exists and belongs to the authenticated partner.
    //    Soft-deleted orders return 404 (rather than letting partner clients
    //    "resurrect" deleted orders by updating them).
    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { id: validatedData.id },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (!existingOrder || existingOrder.deletedAt) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Order not found',
        },
        { status: 404 }
      );
    }

    // Verify this order belongs to the authenticated partner.
    if (!isPartnerOrder(existingOrder.orderNumber, existingOrder.user.email, partner)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'This order cannot be updated via the partner API',
        },
        { status: 403 }
      );
    }

    if (!isOrderEditable(existingOrder.status)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Order cannot be updated in current status: ${existingOrder.status}`,
        },
        { status: 422 }
      );
    }

    if (!isDeliveryTimeAvailable(validatedData.deliveryDate, validatedData.deliveryTime)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message:
            'Delivery time is not available - must be at least 2 hours in advance and within business hours (7 AM - 10 PM)',
        },
        { status: 422 }
      );
    }

    // 5. Fast-path duplicate check on rename (excluding current order and
    //    soft-deleted rows). The DB unique constraint at update time is
    //    the authoritative race-safe guard (handled in catch block below).
    const normalizedOrderNumber = buildOrderNumber(validatedData.orderCode, partner.orderPrefix);
    if (normalizedOrderNumber !== existingOrder.orderNumber) {
      const duplicateOrder = await prisma.cateringRequest.findFirst({
        where: {
          orderNumber: normalizedOrderNumber,
          id: { not: validatedData.id },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (duplicateOrder) {
        return storeAndReturnResponse(idempotency, 409, {
          status: 'ERROR',
          message: `Order with code ${validatedData.orderCode} already exists`,
        });
      }
    }

    let distance: number;
    let usedFallbackDistance: boolean;
    let pricingResult: PricingCalculationResult['pricingResult'];

    try {
      const result = await calculateCaterValleyPricing({
        orderCode: validatedData.orderCode,
        pickupLocation: validatedData.pickupLocation,
        dropOffLocation: validatedData.dropOffLocation,
        totalItem: validatedData.totalItem,
        priceTotal: validatedData.priceTotal,
        feature: `${partner.slug}_webhook_update`,
      });

      distance = result.distance;
      usedFallbackDistance = result.usedFallbackDistance;
      pricingResult = result.pricingResult;
    } catch (error) {
      // Log server-side, never echo error.message across the partner trust boundary.
      // See PR #402 pre-landing review #13.
      console.error('[CaterValley update] Pricing calculation failed:', error);
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Pricing calculation failed. Please verify pickup/delivery addresses and order details, then retry.',
        },
        { status: 422 }
      );
    }

    const { localTimeToUtc } = await import('@/lib/utils/timezone');
    const deliveryDateTime = new Date(
      localTimeToUtc(validatedData.deliveryDate, validatedData.deliveryTime)
    );
    const pickupTime = calculatePickupTime(validatedData.deliveryDate, validatedData.deliveryTime);

    let updatedOrder;
    try {
      updatedOrder = await prisma.$transaction(async (tx) => {
        const [pickupAddressRecord, deliveryAddressRecord] = await Promise.all([
          ensureAddress(validatedData.pickupLocation, tx),
          ensureAddress(validatedData.dropOffLocation, tx),
        ]);

        return tx.cateringRequest.update({
          where: { id: validatedData.id },
          data: {
            orderNumber: normalizedOrderNumber,
            pickupAddressId: pickupAddressRecord.id,
            deliveryAddressId: deliveryAddressRecord.id,
            headcount: validatedData.totalItem,
            orderTotal: validatedData.priceTotal,
            pickupDateTime: new Date(pickupTime),
            arrivalDateTime: deliveryDateTime,
            clientAttention: validatedData.dropOffLocation.recipient.name,
            pickupNotes: `${partner.displayName} Order - Pickup from: ${validatedData.pickupLocation.name}`,
            specialNotes: usedFallbackDistance
              ? `${validatedData.dropOffLocation.instructions || ''}\n[FALLBACK DISTANCE: ${distance}mi - Manual review needed]`.trim()
              : validatedData.dropOffLocation.instructions || '',
            deliveryCost: pricingResult.deliveryFee,
            deliveryDistance: distance,
            updatedAt: new Date(),
          },
          include: {
            pickupAddress: true,
            deliveryAddress: true,
            user: true,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return storeAndReturnResponse(idempotency, 409, {
          status: 'ERROR',
          message: `Order with code ${validatedData.orderCode} already exists`,
        });
      }
      throw error;
    }

    const response: UpdateOrderResponse = {
      id: updatedOrder.id,
      deliveryPrice: pricingResult.deliveryFee,
      totalPrice: validatedData.priceTotal + pricingResult.deliveryFee,
      estimatedPickupTime: pickupTime,
      status: 'SUCCESS',
      breakdown: {
        basePrice: pricingResult.deliveryCost,
        mileageFee: pricingResult.totalMileagePay,
        dailyDriveDiscount: pricingResult.dailyDriveDiscount,
      },
    };

    return storeAndReturnResponse(idempotency, 200, response);
  } catch (error) {
    console.error('Error updating partner order:', error);

    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          {
            status: 'ERROR',
            message: 'Order with this code already exists',
          },
          { status: 409 }
        );
      }

      if (error.message.includes('Record to update not found')) {
        return NextResponse.json(
          {
            status: 'ERROR',
            message: 'Order not found or has been deleted',
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Internal server error - failed to update order',
      },
      { status: 500 }
    );
  }
}
