import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { OrderConfirmationData } from '@/types/order-confirmation';
import { defaultNextSteps } from '@/lib/order-confirmation';

export async function GET(req: NextRequest, { params }: { params: Promise<{ order_number: string }> }) {
  const { order_number } = await params;
  if (!order_number) {
    return NextResponse.json({ error: 'Order number is required' }, { status: 400 });
  }

  // Try to find the order in cateringRequest
  const order = await prisma.cateringRequest.findUnique({
    where: { orderNumber: order_number },
    include: {
      user: true,
      deliveryAddress: true,
      pickupAddress: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Map to OrderConfirmationData
  const confirmationData: OrderConfirmationData = {
    orderNumber: order.orderNumber,
    orderType: 'CATERING',
    eventDetails: {
      eventName: order.clientAttention || '',
      eventDate: order.pickupDateTime || order.createdAt,
      location: order.deliveryAddress?.street1 || '',
    },
    customerInfo: {
      name: order.user?.name || '',
      email: order.user?.email || '',
      phone: order.user?.contactNumber || '',
    },
    estimatedDelivery: order.pickupDateTime || order.createdAt,
    nextSteps: defaultNextSteps,
  };

  return NextResponse.json(confirmationData);
} 