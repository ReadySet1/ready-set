/**
 * Catering Request Status Update API
 * Updates order status and triggers webhooks for external partners like CaterValley
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { CarrierService } from '@/lib/services/carrierService';
import { DriverStatus } from '@/types/prisma';
import { invalidateVendorCacheOnStatusUpdate } from '@/lib/cache/cache-invalidation';

// Validation schema for status update request
const StatusUpdateSchema = z.object({
  driverStatus: z.enum([
    'ASSIGNED',
    'ARRIVED_AT_VENDOR',
    'EN_ROUTE_TO_CLIENT',
    'ARRIVED_TO_CLIENT',
    'COMPLETED',
  ]),
  driverId: z.string().uuid().optional(),
  notes: z.string().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type StatusUpdateRequest = z.infer<typeof StatusUpdateSchema>;

interface StatusUpdateResponse {
  success: boolean;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    driverStatus: DriverStatus;
    updatedAt: string;
  };
  webhookResults?: {
    caterValley?: {
      success: boolean;
      attempts: number;
      error?: string;
    };
  };
  message: string;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    // 1. Validate request body
    let requestBody: StatusUpdateRequest;
    try {
      requestBody = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = StatusUpdateSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const validatedData = validationResult.data;

    // 2. Find the order
    const order = await prisma.cateringRequest.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // 3. Validate business rules
    if (!canUpdateToStatus(order.driverStatus, validatedData.driverStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${order.driverStatus || 'NO_STATUS'} to ${validatedData.driverStatus}`,
        },
        { status: 422 }
      );
    }

    // 4. Update the order status
    const updatedOrder = await prisma.cateringRequest.update({
      where: { id: orderId },
      data: {
        driverStatus: validatedData.driverStatus,
        updatedAt: new Date(),
        // Optionally update other fields based on status
        ...(validatedData.driverStatus === 'COMPLETED' && {
          completeDateTime: new Date(),
          status: 'COMPLETED',
        }),
      },
    });

    // 5. Handle external partner webhooks
    const webhookResults: StatusUpdateResponse['webhookResults'] = {};

    // Send webhook to appropriate carrier based on order number
    try {
      const webhookResult = await CarrierService.sendStatusUpdate(
        order.orderNumber,
        validatedData.driverStatus
      );
      
      if (webhookResult) {
        // Map carrier-specific results to the expected format
        if (webhookResult.carrierId === 'catervalley') {
          webhookResults.caterValley = {
            success: webhookResult.success,
            attempts: webhookResult.attempts,
            error: webhookResult.lastError,
          };
        }
        // Future carriers can be added here
      }
    } catch (error) {
      console.error('Error sending carrier webhook:', error);
      const carrierInfo = CarrierService.detectCarrier(order.orderNumber);
      if (carrierInfo?.id === 'catervalley') {
        webhookResults.caterValley = {
          success: false,
          attempts: 0,
          error: error instanceof Error ? error.message : 'Unknown webhook error',
        };
      }
    }

    // 6. Create dispatch record if driver is assigned
    if (validatedData.driverStatus === 'ASSIGNED' && validatedData.driverId) {
      await prisma.dispatch.create({
        data: {
          cateringRequestId: orderId,
          driverId: validatedData.driverId,
          userId: order.userId,
        },
      });
    }

    // 7. Log status change
    
    // 8. Invalidate vendor cache since order status affects metrics and order lists
    invalidateVendorCacheOnStatusUpdate(order.userId, orderId);

    // 9. Return success response
    const response: StatusUpdateResponse = {
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        driverStatus: updatedOrder.driverStatus!,
        updatedAt: updatedOrder.updatedAt.toISOString(),
      },
      webhookResults,
      message: `Order status successfully updated to ${validatedData.driverStatus}`,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Error updating order status:', error);

    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        return NextResponse.json(
          { error: 'Order not found or has been deleted' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error - failed to update order status' },
      { status: 500 }
    );
  }
}

/**
 * Validates if a status transition is allowed
 */
function canUpdateToStatus(currentStatus: DriverStatus | null, newStatus: DriverStatus): boolean {
  // Define valid status transitions
  const validTransitions: Record<string, DriverStatus[]> = {
    'null': ['ASSIGNED'],
    'ASSIGNED': ['ARRIVED_AT_VENDOR', 'COMPLETED'], // Can skip directly to completed if needed
    'ARRIVED_AT_VENDOR': ['EN_ROUTE_TO_CLIENT', 'COMPLETED'],
    'EN_ROUTE_TO_CLIENT': ['ARRIVED_TO_CLIENT', 'COMPLETED'],
    'ARRIVED_TO_CLIENT': ['COMPLETED'],
    'COMPLETED': [], // Terminal status - no further transitions
  };

  const currentKey = currentStatus || 'null';
  const allowedStatuses = validTransitions[currentKey] || [];
  
  return allowedStatuses.includes(newStatus);
}

/**
 * Get order status - GET endpoint
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    const order = await prisma.cateringRequest.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        driverStatus: true,
        pickupDateTime: true,
        arrivalDateTime: true,
        completeDateTime: true,
        updatedAt: true,
        dispatches: {
          select: {
            id: true,
            driverId: true,
            createdAt: true,
            driver: {
              select: {
                id: true,
                name: true,
                contactNumber: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });

  } catch (error) {
    console.error('Error fetching order status:', error);
    return NextResponse.json(
      { error: 'Internal server error - failed to fetch order status' },
      { status: 500 }
    );
  }
} 