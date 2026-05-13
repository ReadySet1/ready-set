/**
 * Partner Order API — Draft endpoint.
 *
 * Receives a candidate order from a partner platform, calculates a
 * delivery quote, persists the draft, and returns the order id +
 * pricing. Partner identity is resolved from the `partner` +
 * `x-api-key` headers via the api_partners registry; the `partner`
 * row's order prefix and display name drive how the order is stored.
 *
 * Available at both `/api/cater-valley/orders/draft` (legacy URL kept
 * for CaterValley) and `/api/partners/orders/draft` (canonical URL
 * advertised in the partner contract). The two are wired to the same
 * handler — see src/app/api/partners/orders/draft/route.ts.
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
  buildOrderGuid,
  ensurePartnerSystemUser,
  calculateCaterValleyPricing,
  type PricingCalculationResult,
} from '@/app/api/cater-valley/_lib';

// Validation schema — same shape across all partners. The contract is
// fixed by the API spec; partner identity comes from headers, not body.
const DraftOrderSchema = z.object({
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

type DraftOrderRequest = z.infer<typeof DraftOrderSchema>;

interface DraftOrderResponse {
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
    // 0. Reject oversized bodies before doing any work.
    const sizeReject = enforceBodySizeLimit(request);
    if (sizeReject) return sizeReject;

    // 1. Authentication — resolve partner from headers via registry.
    const auth = await authenticatePartnerRequest(request);
    if (!auth.ok) return auth.response;
    const { partner } = auth;

    // 1a. Per-partner rate limit (after auth so we can attribute the count
    //     to a specific partner).
    const rateLimitReject = await enforceRateLimit(partner.slug, 'orders.draft');
    if (rateLimitReject) return rateLimitReject;

    // 1b. Idempotency-Key replay — namespaced by partner slug.
    const idempotency = readIdempotencyContext(request, partner.slug);
    const replay = await replayCachedResponse(idempotency);
    if (replay) return replay;

    // 2. Parse and validate request body
    let requestBody: DraftOrderRequest;
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

    const validationResult = DraftOrderSchema.safeParse(requestBody);
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

    // 3. Business validation
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

    // 4. Fast-path duplicate check (also catches soft-deleted orders to
    //    prevent resurrection by partner retry). Note: this is a UX
    //    nicety — the authoritative duplicate check is the unique
    //    constraint enforced by the DB at create time (step 7), which
    //    closes the read-then-write race window.
    const normalizedOrderNumber = buildOrderNumber(validatedData.orderCode, partner.orderPrefix);
    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { orderNumber: normalizedOrderNumber },
      select: { id: true, deletedAt: true },
    });

    if (existingOrder && !existingOrder.deletedAt) {
      return storeAndReturnResponse(idempotency, 409, {
        status: 'ERROR',
        message: `Order with code ${validatedData.orderCode} already exists`,
      });
    }

    // 5. Calculate pricing with distance, bridge toll detection, and validation
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
        feature: `${partner.slug}_webhook_draft`,
      });

      distance = result.distance;
      usedFallbackDistance = result.usedFallbackDistance;
      pricingResult = result.pricingResult;
    } catch (error) {
      // Log the underlying error for ops but never echo error.message across the
      // partner trust boundary — it can leak Prisma column names, file paths, or
      // upstream provider response text. See PR #402 pre-landing review #13.
      console.error('[CaterValley draft] Pricing calculation failed:', error);
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Pricing calculation failed. Please verify pickup/delivery addresses and order details, then retry.',
        },
        { status: 422 }
      );
    }

    // 7. Create database entities atomically. The system user upsert,
    //    both address lookups/inserts, and the order create all run
    //    inside a single transaction so a failure at any step rolls
    //    back the whole thing — no orphaned addresses or half-created
    //    orders.
    const { localTimeToUtc } = await import('@/lib/utils/timezone');
    const deliveryDateTime = new Date(
      localTimeToUtc(validatedData.deliveryDate, validatedData.deliveryTime)
    );
    const pickupTime = calculatePickupTime(validatedData.deliveryDate, validatedData.deliveryTime);

    let draftOrder;
    try {
      draftOrder = await prisma.$transaction(async (tx) => {
        const [systemUser, pickupAddressRecord, deliveryAddressRecord] = await Promise.all([
          ensurePartnerSystemUser(partner, tx),
          ensureAddress(validatedData.pickupLocation, tx),
          ensureAddress(validatedData.dropOffLocation, tx),
        ]);

        return tx.cateringRequest.create({
          data: {
            orderNumber: normalizedOrderNumber,
            status: 'ACTIVE',
            userId: systemUser.id,
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
            brokerage: partner.displayName,
            deliveryCost: pricingResult.deliveryFee,
            deliveryDistance: distance,
            guid: buildOrderGuid(validatedData.orderCode, partner),
          },
          include: {
            pickupAddress: true,
            deliveryAddress: true,
            user: true,
          },
        });
      });
    } catch (error) {
      // Race-safe: if a concurrent request created the same orderNumber
      // between our fast-path check and this insert, Prisma raises
      // P2002 (unique constraint). Convert to a deterministic 409 instead
      // of a 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return storeAndReturnResponse(idempotency, 409, {
          status: 'ERROR',
          message: `Order with code ${validatedData.orderCode} already exists`,
        });
      }
      throw error;
    }

    // 9. Return success response
    const response: DraftOrderResponse = {
      id: draftOrder.id,
      deliveryPrice: pricingResult.deliveryFee,
      totalPrice: validatedData.priceTotal + pricingResult.deliveryFee,
      estimatedPickupTime: pickupTime,
      status: 'SUCCESS',
      breakdown: {
        basePrice: pricingResult.deliveryCost,
        mileageFee: pricingResult.totalMileagePay,
        dailyDriveDiscount: pricingResult.dailyDriveDiscount,
        // Note: Bridge toll ($8) is NOT included - it's driver compensation paid by Ready Set
      },
    };

    return storeAndReturnResponse(idempotency, 201, response);
  } catch (error) {
    console.error('Error creating partner draft order:', error);

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
    }

    return NextResponse.json(
      {
        status: 'ERROR',
        message: 'Internal server error - failed to create draft order',
      },
      { status: 500 }
    );
  }
}
