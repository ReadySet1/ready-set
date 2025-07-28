import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;

    const order = await prisma.cateringRequest.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pickupAddress: true,
        deliveryAddress: true,
        dispatches: {
          include: {
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
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        driverStatus: order.driverStatus,
        pickupDateTime: order.pickupDateTime,
        arrivalDateTime: order.arrivalDateTime,
        completeDateTime: order.completeDateTime,
        updatedAt: order.updatedAt,
        headcount: order.headcount,
        needHost: order.needHost,
        hoursNeeded: order.hoursNeeded,
        numberOfHosts: order.numberOfHosts,
        brokerage: order.brokerage,
        orderTotal: order.orderTotal?.toString() || "0.00",
        tip: order.tip?.toString() || "0.00",
        clientAttention: order.clientAttention,
        pickupNotes: order.pickupNotes,
        specialNotes: order.specialNotes,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        dispatches: order.dispatches,
      },
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json(
      { error: 'Internal server error - failed to fetch order details' },
      { status: 500 }
    );
  }
} 