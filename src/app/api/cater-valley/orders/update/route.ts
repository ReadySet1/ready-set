/**
 * CaterValley Orders Update API Endpoint
 * Allows CaterValley to update existing draft orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { calculateDistance, calculatePickupTime, isDeliveryTimeAvailable, extractCity } from '@/lib/services/pricingService';
import { calculateDeliveryCost } from '@/lib/calculator/delivery-cost-calculator';
import { captureException, captureMessage } from '@/lib/monitoring/sentry';
import { getConfiguration } from '@/lib/calculator/client-configurations';

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

/**
 * Authentication middleware for CaterValley requests
 */
function validateCaterValleyAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const partner = request.headers.get('partner');
  
  if (partner !== 'catervalley') {
    return false;
  }
  
  const expectedApiKey = process.env.CATERVALLEY_API_KEY;
  if (expectedApiKey && apiKey !== expectedApiKey) {
    return false;
  }
  
  return true;
}

/**
 * Creates or finds an address
 */
async function ensureAddress(location: UpdateOrderRequest['pickupLocation'] | UpdateOrderRequest['dropOffLocation']): Promise<{ id: string }> {
  const zipCode = location.zip || extractZipFromAddress(location.address);
  
  const existingAddress = await prisma.address.findFirst({
    where: {
      street1: location.address,
      city: location.city,
      state: location.state,
      zip: zipCode,
    },
    select: { id: true },
  });

  if (existingAddress) {
    return existingAddress;
  }

  const newAddress = await prisma.address.create({
    data: {
      street1: location.address,
      city: location.city,
      state: location.state,
      zip: zipCode,
      name: location.name,
      isRestaurant: false,
    },
    select: { id: true },
  });

  return newAddress;
}

/**
 * Extract ZIP code from address string
 */
function extractZipFromAddress(address: string): string {
  const zipMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  return zipMatch ? zipMatch[0] : '';
}

export async function POST(request: NextRequest) {
  try {
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

    // 3. Check if order exists and belongs to CaterValley
    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { id: validatedData.id },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Order not found',
        },
        { status: 404 }
      );
    }

    // Verify this is a CaterValley order
    if (!existingOrder.orderNumber.startsWith('CV-') || existingOrder.user.email !== 'system@catervalley.com') {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'This order cannot be updated via CaterValley API',
        },
        { status: 403 }
      );
    }

    // Check if order is in a state that allows updates
    if (!['PENDING', 'ACTIVE'].includes(existingOrder.status)) {
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

    // 5. Check for duplicate order codes (excluding current order)
    if (validatedData.orderCode !== existingOrder.orderNumber.replace('CV-', '')) {
      const duplicateOrder = await prisma.cateringRequest.findFirst({
        where: { 
          orderNumber: `CV-${validatedData.orderCode}`,
          id: { not: validatedData.id },
        },
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

    // 4. Calculate distance between pickup and dropoff
    const pickupAddress = `${validatedData.pickupLocation.address}, ${validatedData.pickupLocation.city}, ${validatedData.pickupLocation.state}`;
    const dropoffAddress = `${validatedData.dropOffLocation.address}, ${validatedData.dropOffLocation.city}, ${validatedData.dropOffLocation.state}`;

    let distance: number;
    let usedFallbackDistance = false;

    try {
      distance = await calculateDistance(pickupAddress, dropoffAddress);
    } catch (error) {
      // Track distance calculation failure in Sentry for operational visibility
      captureException(error as Error, {
        action: 'calculate_distance',
        feature: 'catervalley_webhook_update',
        metadata: {
          orderCode: validatedData.orderCode,
          pickupAddress: pickupAddress,
          dropoffAddress: dropoffAddress
        }
      });

      // Use fallback distance of 5 miles to allow order to proceed
      distance = 5;
      usedFallbackDistance = true;

      // Log warning with Sentry tracking
      const warningMessage = `Using fallback distance of ${distance} miles for CaterValley order ${validatedData.orderCode}`;
      console.warn(warningMessage);
      captureMessage(warningMessage, 'warning', {
        action: 'fallback_distance_used',
        feature: 'catervalley_webhook_update',
        metadata: { orderCode: validatedData.orderCode, fallbackDistance: distance }
      });
    }

    // 4b. Detect bridge toll requirement
    const pickupCity = extractCity(pickupAddress);
    const dropoffCity = extractCity(dropoffAddress);
    const caterValleyConfig = getConfiguration('cater-valley');

    // Check if route crosses bridge (both cities in autoApplyForAreas but different cities)
    let numberOfBridges = 0;
    if (caterValleyConfig?.bridgeTollSettings.autoApplyForAreas) {
      const tollAreas = caterValleyConfig.bridgeTollSettings.autoApplyForAreas;
      const pickupInTollArea = tollAreas.includes(pickupCity);
      const dropoffInTollArea = tollAreas.includes(dropoffCity);

      // If both are in toll areas and are different cities, bridge crossing likely
      if (pickupInTollArea && dropoffInTollArea && pickupCity !== dropoffCity) {
        numberOfBridges = 1;
      }
    }

    // 5. Recalculate pricing using CaterValley configuration
    const pricingResult = calculateDeliveryCost({
      headcount: validatedData.totalItem,
      foodCost: validatedData.priceTotal,
      totalMileage: distance,
      numberOfDrives: 1, // CaterValley orders are standalone (no daily drive discounts)
      requiresBridge: numberOfBridges > 0,
      clientConfigId: 'cater-valley' // Use CaterValley-specific configuration
    });

    // 5b. CRITICAL: Validate that pricing is not zero (prevent revenue loss)
    if (pricingResult.deliveryFee <= 0) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'Pricing calculation error - delivery fee cannot be zero. Please contact support.',
        },
        { status: 422 }
      );
    }

    // 6. Update or create addresses
    const [pickupAddressRecord, deliveryAddressRecord] = await Promise.all([
      ensureAddress(validatedData.pickupLocation),
      ensureAddress(validatedData.dropOffLocation),
    ]);

    // 7. Update the order
    // Import timezone utility for proper conversion
    const { localTimeToUtc } = await import('@/lib/utils/timezone');
    const deliveryDateTime = new Date(localTimeToUtc(validatedData.deliveryDate, validatedData.deliveryTime));
    const pickupTime = calculatePickupTime(validatedData.deliveryDate, validatedData.deliveryTime);

    const updatedOrder = await prisma.cateringRequest.update({
      where: { id: validatedData.id },
      data: {
        orderNumber: `CV-${validatedData.orderCode}`,
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
        updatedAt: new Date(),
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        user: true,
      },
    });

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
        bridgeToll: pricingResult.bridgeToll,
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