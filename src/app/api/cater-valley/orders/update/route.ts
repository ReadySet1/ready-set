/**
 * CaterValley Orders Update API Endpoint
 * Allows CaterValley to update existing draft orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { calculatePickupTime, isDeliveryTimeAvailable } from '@/lib/services/pricingService';
import { enforceBodySizeLimit } from '@/lib/security/body-size-limit';
import {
  validateCaterValleyAuth,
  ensureAddress,
  normalizeOrderNumber,
  isOrderEditable,
  isCaterValleyOrder,
  calculateCaterValleyPricing,
  type PricingCalculationResult,
} from '@/app/api/cater-valley/_lib';

// Validation schema for CaterValley update order request
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
    mileageFee?: number;         // Dollar amount for mileage over 10 miles
    dailyDriveDiscount?: number; // Dollar amount discount for multiple daily drives
    bridgeToll?: number;         // Dollar amount for bridge toll
    peakTimeMultiplier?: number; // Reserved for future use
  };
}

export async function POST(request: NextRequest) {
  try {
    // 0. Reject oversized bodies before doing any work.
    const sizeReject = enforceBodySizeLimit(request);
    if (sizeReject) return sizeReject;

    // 1. Authentication
    if (!validateCaterValleyAuth(request)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Unauthorized - Invalid API key or partner header'
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let requestBody: UpdateOrderRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json(
        { 
          status: 'ERROR',
          message: 'Invalid JSON in request body' 
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

    // 3. Check if order exists and belongs to CaterValley.
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

    // Verify this is a CaterValley order
    if (!isCaterValleyOrder(existingOrder.orderNumber, existingOrder.user.email)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'This order cannot be updated via CaterValley API',
        },
        { status: 403 }
      );
    }

    // Check if order is in a state that allows updates
    if (!isOrderEditable(existingOrder.status)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Order cannot be updated in current status: ${existingOrder.status}`,
        },
        { status: 422 }
      );
    }

    // 4. Business validation
    if (!isDeliveryTimeAvailable(validatedData.deliveryDate, validatedData.deliveryTime)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Delivery time is not available - must be at least 2 hours in advance and within business hours (7 AM - 10 PM)',
        },
        { status: 422 }
      );
    }

    // 5. Fast-path duplicate check on rename (excluding current order and
    //    soft-deleted rows). The DB unique constraint at update time is
    //    the authoritative race-safe guard (handled in catch block below).
    const normalizedOrderNumber = normalizeOrderNumber(validatedData.orderCode);
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
        return NextResponse.json(
          {
            status: 'ERROR',
            message: `Order with code ${validatedData.orderCode} already exists`,
          },
          { status: 409 }
        );
      }
    }

    // 4. Calculate pricing with distance, bridge toll detection, and validation
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
        feature: 'catervalley_webhook_update'
      });

      distance = result.distance;
      usedFallbackDistance = result.usedFallbackDistance;
      pricingResult = result.pricingResult;
    } catch (error) {
      // Pricing calculation error (e.g., zero delivery fee)
      return NextResponse.json(
        {
          status: 'ERROR',
          message: error instanceof Error ? error.message : 'Pricing calculation error',
        },
        { status: 422 }
      );
    }

    // 6. Address upserts and order update run in a single transaction so
    //    a newly inserted address can't be left orphaned by a failed
    //    order update.
    const { localTimeToUtc } = await import('@/lib/utils/timezone');
    const deliveryDateTime = new Date(localTimeToUtc(validatedData.deliveryDate, validatedData.deliveryTime));
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
            pickupNotes: `CaterValley Order - Pickup from: ${validatedData.pickupLocation.name}`,
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
      // Race-safe: a concurrent request may have claimed the new orderNumber
      // between our fast-path check and the update.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return NextResponse.json(
          {
            status: 'ERROR',
            message: `Order with code ${validatedData.orderCode} already exists`,
          },
          { status: 409 }
        );
      }
      throw error;
    }

    // 8. Return success response
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
        // Note: Bridge toll ($8) is NOT included - it's driver compensation paid by Ready Set
      },
    };


    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error updating CaterValley order:', error);

    // Handle specific database errors
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