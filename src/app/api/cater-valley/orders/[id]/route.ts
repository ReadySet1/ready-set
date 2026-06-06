/**
 * Partner Order API — Read endpoint.
 *
 * Returns the current status plus the recent partner-facing lifecycle
 * events for a single order, so a partner can resync after a missed
 * webhook callback. Same partner identity resolution and ownership check
 * as the write endpoints: partner A can't read partner B's orders even
 * with valid credentials.
 *
 * Available at both `/api/cater-valley/orders/{id}` and
 * `/api/partners/orders/{id}`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { authenticatePartnerRequest, isPartnerOrder } from '@/app/api/cater-valley/_lib';

const HISTORY_LIMIT = 10;

const IdSchema = z.string().uuid('Invalid order ID format');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticatePartnerRequest(request);
    if (!auth.ok) return auth.response;
    const { partner } = auth;

    const rateLimitReject = await enforceRateLimit(partner.slug, 'orders.get');
    if (rateLimitReject) return rateLimitReject;

    const { id } = await context.params;
    const idResult = IdSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        { status: 'ERROR', message: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    const order = await prisma.cateringRequest.findUnique({
      where: { id: idResult.data },
      include: {
        user: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: HISTORY_LIMIT,
        },
      },
    });

    // Soft-deleted orders read as not-found across the partner boundary.
    if (!order || order.deletedAt) {
      return NextResponse.json(
        { status: 'ERROR', message: 'Order not found' },
        { status: 404 }
      );
    }

    if (!isPartnerOrder(order.orderNumber, order.user.email, partner)) {
      return NextResponse.json(
        { status: 'ERROR', message: 'This order cannot be read via the partner API' },
        { status: 403 }
      );
    }

    const orderCode = order.orderNumber.startsWith(partner.orderPrefix)
      ? order.orderNumber.slice(partner.orderPrefix.length)
      : order.orderNumber;

    // The partner-facing lifecycle status is the latest recorded event
    // (history is ordered newest-first). Null until the order is dispatched.
    const lifecycleStatus = order.statusHistory[0]?.partnerStatus ?? null;

    return NextResponse.json({
      status: 'SUCCESS',
      order: {
        id: order.id,
        orderCode,
        orderNumber: order.orderNumber,
        // Internal order state (ACTIVE = draft, CONFIRMED, CANCELLED, …).
        orderStatus: order.status,
        // Latest partner-facing lifecycle event, if any.
        lifecycleStatus,
        deliveryDate: order.arrivalDateTime?.toISOString() ?? null,
        events: order.statusHistory.map((e) => ({
          status: e.partnerStatus,
          driverStatus: e.driverStatus,
          timestamp: e.createdAt.toISOString(),
          location: e.location ?? undefined,
          notes: e.notes ?? undefined,
        })),
      },
    });
  } catch (error) {
    console.error('Error reading partner order:', error);
    return NextResponse.json(
      { status: 'ERROR', message: 'Internal server error - failed to read order' },
      { status: 500 }
    );
  }
}
