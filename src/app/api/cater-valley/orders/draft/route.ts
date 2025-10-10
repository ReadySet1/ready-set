/**
 * CaterValley Orders Draft API Endpoint
 * Receives order data from CaterValley and creates a draft order
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { calculateDeliveryPrice, calculatePickupTime, isDeliveryTimeAvailable } from '@/lib/services/pricingService';

// Validation schema for CaterValley draft order request
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
  metadata: z.record(z.unknown()).optional(),
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
    itemCountMultiplier?: number;
    orderTotalMultiplier?: number;
    distanceMultiplier?: number;
    peakTimeMultiplier?: number;
  };
}

/**
 * Authentication middleware for CaterValley requests
 */
function validateCaterValleyAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const partner = request.headers.get('partner');
  
  // Check for CaterValley-specific authentication
  if (partner !== 'catervalley') {
    return false;
  }
  
  // In production, validate the API key against stored credentials
  const expectedApiKey = process.env.CATERVALLEY_API_KEY;
  if (expectedApiKey && apiKey !== expectedApiKey) {
    return false;
  }
  
  return true;
}

/**
 * Creates or finds a CaterValley system user
 */
async function ensureCaterValleySystemUser() {
  return await prisma.profile.upsert({
    where: { email: 'system@catervalley.com' },
    update: { 
      updatedAt: new Date(),
      status: 'ACTIVE',
    },
    create: {
      email: 'system@catervalley.com',
      name: 'CaterValley System',
      type: 'CLIENT',
      companyName: 'CaterValley',
      status: 'ACTIVE',
    },
  });
}

/**
 * Creates or finds an address
 */
async function ensureAddress(location: DraftOrderRequest['pickupLocation'] | DraftOrderRequest['dropOffLocation']): Promise<{ id: string }> {
  // Parse ZIP from address if not provided separately
  const zipCode = location.zip || extractZipFromAddress(location.address);
  
  // First, try to find an existing address
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

  // Create new address if not found
  const newAddress = await prisma.address.create({
    data: {
      street1: location.address,
      city: location.city,
      state: location.state,
      zip: zipCode,
      name: location.name,
      isRestaurant: false, // We'll determine this based on context later
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
    let requestBody: DraftOrderRequest;
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
          message: 'Delivery time is not available - must be at least 2 hours in advance and within business hours (7 AM - 10 PM)',
        },
        { status: 422 }
      );
    }

    // 4. Check for duplicate orders
    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { orderNumber: `CV-${validatedData.orderCode}` },
    });

    if (existingOrder) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Order with code ${validatedData.orderCode} already exists`,
        },
        { status: 409 }
      );
    }

    // 5. Calculate pricing with updated parameters
    const pricingResult = await calculateDeliveryPrice({
      pickupAddress: `${validatedData.pickupLocation.address}, ${validatedData.pickupLocation.city}, ${validatedData.pickupLocation.state}`,
      dropoffAddress: `${validatedData.dropOffLocation.address}, ${validatedData.dropOffLocation.city}, ${validatedData.dropOffLocation.state}`,
      headCount: validatedData.totalItem, // Using totalItem as headCount
      foodCost: validatedData.priceTotal, // Using priceTotal as foodCost
      deliveryDate: validatedData.deliveryDate,
      deliveryTime: validatedData.deliveryTime,
      includeTip: true // Default to including tip for CaterValley orders
    });

    // 6. Create database entities
    const [systemUser, pickupAddress, deliveryAddress] = await Promise.all([
      ensureCaterValleySystemUser(),
      ensureAddress(validatedData.pickupLocation),
      ensureAddress(validatedData.dropOffLocation),
    ]);

    // 7. Create the draft order
    // Import timezone utility for proper conversion
    const { localTimeToUtc } = await import('@/lib/utils/timezone');
    const deliveryDateTime = new Date(localTimeToUtc(validatedData.deliveryDate, validatedData.deliveryTime));
    const pickupTime = calculatePickupTime(validatedData.deliveryDate, validatedData.deliveryTime);

    const draftOrder = await prisma.cateringRequest.create({
      data: {
        orderNumber: `CV-${validatedData.orderCode}`,
        status: 'ACTIVE',
        userId: systemUser.id,
        pickupAddressId: pickupAddress.id,
        deliveryAddressId: deliveryAddress.id,
        headcount: validatedData.totalItem,
        orderTotal: validatedData.priceTotal,
        pickupDateTime: new Date(pickupTime),
        arrivalDateTime: deliveryDateTime,
        clientAttention: validatedData.dropOffLocation.recipient.name,
        pickupNotes: `CaterValley Order - Pickup from: ${validatedData.pickupLocation.name}`,
        specialNotes: validatedData.dropOffLocation.instructions || '',
        brokerage: 'CaterValley',
        // Store additional metadata in a JSON field if your schema supports it
        guid: `cv-${validatedData.orderCode}-${Date.now()}`,
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        user: true,
      },
    });

    // 8. Return success response
    const response: DraftOrderResponse = {
      id: draftOrder.id,
      deliveryPrice: pricingResult.deliveryPrice,
      totalPrice: validatedData.priceTotal + pricingResult.deliveryPrice,
      estimatedPickupTime: pickupTime,
      status: 'SUCCESS',
      breakdown: pricingResult.breakdown,
    };

    console.log(`Created CaterValley draft order ${draftOrder.orderNumber} for ${validatedData.priceTotal} + ${pricingResult.deliveryPrice} delivery`);

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating CaterValley draft order:', error);

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