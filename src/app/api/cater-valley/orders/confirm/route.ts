/**
 * CaterValley Orders Confirm API Endpoint
 * Confirms or cancels orders from CaterValley
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';

// Validation schema for CaterValley confirm order request
const ConfirmOrderSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
  isAccepted: z.boolean(),
  reason: z.string().optional(), // For rejection reasons
  metadata: z.record(z.unknown()).optional(),
});

type ConfirmOrderRequest = z.infer<typeof ConfirmOrderSchema>;

interface ConfirmOrderResponse {
  id: string;
  orderNumber: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'ERROR';
  message: string;
  estimatedDeliveryTime?: string;
  driverAssignment?: {
    expectedAssignmentTime: string;
    trackingAvailable: boolean;
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
 * Triggers internal dispatch processes for confirmed orders
 */
async function triggerOrderDispatch(orderId: string): Promise<void> {
  try {
    // In a real implementation, this would:
    // 1. Add the order to the dispatch queue
    // 2. Notify available drivers
    // 3. Start the driver assignment process
    // 4. Set up tracking and notifications

    console.log(`Order ${orderId} has been queued for driver assignment`);
    
    // For now, we'll just log the action
    // In the future, you might call internal services here:
    // await dispatchService.queueOrder(orderId);
    // await notificationService.notifyDrivers(orderId);
    
  } catch (error) {
    console.error(`Failed to trigger dispatch for order ${orderId}:`, error);
    // Don't throw here - we don't want to fail the confirmation if dispatch setup fails
  }
}

/**
 * Calculates estimated delivery time based on pickup time and service area
 */
function calculateEstimatedDeliveryTime(pickupDateTime: Date): string {
  // Add typical delivery time (30-60 minutes depending on distance)
  const estimatedDeliveryTime = new Date(pickupDateTime.getTime() + 45 * 60 * 1000); // 45 minutes average
  return estimatedDeliveryTime.toISOString();
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
    let requestBody: ConfirmOrderRequest;
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

    const validationResult = ConfirmOrderSchema.safeParse(requestBody);
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
          message: 'This order cannot be confirmed via CaterValley API',
        },
        { status: 403 }
      );
    }

    // Check if order is in a state that allows confirmation
    if (!['PENDING', 'ACTIVE'].includes(existingOrder.status)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Order cannot be confirmed in current status: ${existingOrder.status}`,
        },
        { status: 422 }
      );
    }

    // 4. Process confirmation or cancellation
    if (!validatedData.isAccepted) {
      // Cancel the order
      const cancelledOrder = await prisma.cateringRequest.update({
        where: { id: validatedData.id },
        data: { 
          status: 'CANCELLED',
          specialNotes: validatedData.reason 
            ? `${existingOrder.specialNotes || ''}\nCancellation reason: ${validatedData.reason}`.trim()
            : existingOrder.specialNotes,
          updatedAt: new Date(),
        },
      });

      console.log(`Cancelled CaterValley order ${cancelledOrder.orderNumber}. Reason: ${validatedData.reason || 'Not specified'}`);

      return NextResponse.json({
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        status: 'CANCELLED' as const,
        message: 'Order has been cancelled successfully',
      }, { status: 200 });
    }

    // 5. Confirm the order
    const confirmedOrder = await prisma.cateringRequest.update({
      where: { id: validatedData.id },
      data: { 
        status: 'CONFIRMED',
        updatedAt: new Date(),
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    // 6. Trigger internal dispatch processes
    await triggerOrderDispatch(confirmedOrder.id);

    // 7. Calculate response data
    const estimatedDeliveryTime = confirmedOrder.pickupDateTime 
      ? calculateEstimatedDeliveryTime(confirmedOrder.pickupDateTime)
      : undefined;

    const response: ConfirmOrderResponse = {
      id: confirmedOrder.id,
      orderNumber: confirmedOrder.orderNumber,
      status: 'CONFIRMED',
      message: 'Order has been confirmed and is ready for dispatch',
      estimatedDeliveryTime,
      driverAssignment: {
        expectedAssignmentTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        trackingAvailable: true,
      },
    };

    console.log(`Confirmed CaterValley order ${confirmedOrder.orderNumber} - ready for driver assignment`);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error confirming CaterValley order:', error);

    // Handle specific database errors
    if (error instanceof Error) {
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
        message: 'Internal server error - failed to confirm order',
      },
      { status: 500 }
    );
  }
} 