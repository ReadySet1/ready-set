/**
 * Carrier Statistics API
 * Provides order statistics and webhook performance metrics for carriers
 *
 * Authentication: Protected by API middleware (admin routes)
 * Authorization: Admin access required
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CarrierService } from '@/lib/services/carrierService';
import { webhookLogger } from '@/lib/services/webhook-logger';
import { carrierLogger } from '@/utils/logger';
import { startOfDay, endOfDay } from 'date-fns';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface CarrierStats {
  totalOrders: number;
  activeOrders: number;
  todayOrders: number;
  webhookSuccess: number | null; // null when webhook logging not yet implemented
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    orderTotal: number;
  }>;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ carrierId: string }> }
) {
  const { carrierId } = await context.params;

  try {

    // Validate carrier ID
    const carrier = CarrierService.getCarrier(carrierId);
    if (!carrier) {
      return NextResponse.json(
        { error: 'Carrier not found' },
        { status: 404 }
      );
    }

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    // Get orders for this carrier based on order prefix
    const [totalOrders, activeOrders, todayOrders, recentOrders] = await Promise.all([
      // Total orders for this carrier
      prisma.cateringRequest.count({
        where: {
          orderNumber: {
            startsWith: carrier.orderPrefix,
          },
          deletedAt: null,
        },
      }),

      // Active orders (not completed or cancelled)
      prisma.cateringRequest.count({
        where: {
          orderNumber: {
            startsWith: carrier.orderPrefix,
          },
          status: {
            in: ['ACTIVE', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS'],
          },
          deletedAt: null,
        },
      }),

      // Today's orders
      prisma.cateringRequest.count({
        where: {
          orderNumber: {
            startsWith: carrier.orderPrefix,
          },
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
          deletedAt: null,
        },
      }),

      // Recent orders for display
      prisma.cateringRequest.findMany({
        where: {
          orderNumber: {
            startsWith: carrier.orderPrefix,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true,
          orderTotal: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),
    ]);

    // Calculate webhook success rate from webhook logs
    // Returns null if there are no webhook attempts in the last 30 days
    const webhookSuccessData = await webhookLogger.getSuccessRate(carrierId, 30);
    const webhookSuccess: number | null = webhookSuccessData.successRate;

    const stats: CarrierStats = {
      totalOrders,
      activeOrders,
      todayOrders,
      webhookSuccess,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        orderTotal: order.orderTotal ? Number(order.orderTotal) : 0,
      })),
    };

    return NextResponse.json(stats);

  } catch (error) {
    carrierLogger.error(`[CarrierStats] Error fetching carrier stats for ${carrierId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get webhook performance metrics for a carrier
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ carrierId: string }> }
) {
  const { carrierId } = await context.params;

  try {
    const { dateRange } = await request.json();

    const carrier = CarrierService.getCarrier(carrierId);
    if (!carrier) {
      return NextResponse.json(
        { error: 'Carrier not found' },
        { status: 404 }
      );
    }

    // In a real implementation, this would query a webhook_logs table
    // For now, return mock data
    const mockMetrics = {
      totalWebhooks: Math.floor(Math.random() * 100) + 50,
      successfulWebhooks: Math.floor(Math.random() * 95) + 45,
      failedWebhooks: Math.floor(Math.random() * 5),
      averageLatency: Math.floor(Math.random() * 500) + 200,
      statusBreakdown: {
        CONFIRM: Math.floor(Math.random() * 20) + 10,
        READY: Math.floor(Math.random() * 20) + 10,
        ON_THE_WAY: Math.floor(Math.random() * 20) + 10,
        COMPLETED: Math.floor(Math.random() * 20) + 10,
      },
    };

    return NextResponse.json(mockMetrics);

  } catch (error) {
    carrierLogger.error(`[CarrierStats] Error fetching webhook metrics for ${carrierId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 