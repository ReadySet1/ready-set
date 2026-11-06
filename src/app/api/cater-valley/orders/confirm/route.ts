/**
 * Partner Order API — Confirm endpoint.
 *
 * Finalizes a draft for dispatch (or rejects it). Available at both
 * `/api/cater-valley/orders/confirm` and `/api/partners/orders/confirm`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { enforcePartnerBodyPolicy, readJsonBody } from '@/lib/security/body-size-limit';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  readIdempotencyContext,
  replayCachedResponse,
  storeAndReturnResponse,
} from '@/lib/security/idempotency';
import {
  authenticatePartnerRequest,
  isOrderEditable,
  wasConfirmed,
  CONFIRMED_HISTORY_PROBE,
  CONFIRMED_HISTORY_STATUS,
  CONFIRMED_ORDER_MESSAGE,
  isPartnerOrder,
} from '@/app/api/cater-valley/_lib';
import { recordAndDispatchLifecycleEvent } from '@/lib/services/partnerWebhookService';
import { notifyOrderCreated } from '@/services/orders/notifyOrderCreated';
import { runAfterResponse } from '@/lib/api/after-response';

const ConfirmOrderSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
  isAccepted: z.boolean(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

async function triggerOrderDispatch(orderId: string): Promise<void> {
  try {
    // In a real implementation, this would queue the order, notify
    // drivers, and start tracking. Failure here must not fail the
    // confirmation response — the partner already considers the order
    // accepted, and a dispatch retry can pick it up later.
    void orderId;
  } catch (error) {
    console.error(`Failed to trigger dispatch for order ${orderId}:`, error);
  }
}

function calculateEstimatedDeliveryTime(pickupDateTime: Date): string {
  // 45 minute average between pickup and delivery; replace with a
  // distance-derived estimate once we have one.
  const estimatedDeliveryTime = new Date(pickupDateTime.getTime() + 45 * 60 * 1000);
  return estimatedDeliveryTime.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    // Content-Type (415 on /api/partners) + declared size, before auth.
    const sizeReject = enforcePartnerBodyPolicy(request);
    if (sizeReject) return sizeReject;

    const auth = await authenticatePartnerRequest(request);
    if (!auth.ok) return auth.response;
    const { partner } = auth;

    const rateLimitReject = await enforceRateLimit(partner.slug, 'orders.confirm', partner.rateLimitPerMin);
    if (rateLimitReject) return rateLimitReject;

    const idempotency = readIdempotencyContext(request, partner.slug);
    const replay = await replayCachedResponse(idempotency);
    if (replay) return replay;

    // Read with the size limit enforced on the bytes actually received
    // (a chunked body has no Content-Length to check up front).
    const read = await readJsonBody(request);
    if (!read.ok) return read.response;
    const requestBody = read.body as ConfirmOrderRequest;

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

    const existingOrder = await prisma.cateringRequest.findUnique({
      where: { id: validatedData.id },
      include: {
        user: true,
        pickupAddress: true,
        deliveryAddress: true,
        statusHistory: CONFIRMED_HISTORY_PROBE,
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

    if (!isPartnerOrder(existingOrder.orderNumber, existingOrder.user.email, partner)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: 'This order cannot be confirmed via the partner API',
        },
        { status: 403 }
      );
    }

    if (!isOrderEditable(existingOrder.status)) {
      return NextResponse.json(
        {
          status: 'ERROR',
          message: `Order cannot be confirmed in current status: ${existingOrder.status}`,
        },
        { status: 422 }
      );
    }

    if (wasConfirmed(existingOrder)) {
      return NextResponse.json(
        { status: 'ERROR', message: CONFIRMED_ORDER_MESSAGE },
        { status: 422 }
      );
    }

    if (!validatedData.isAccepted) {
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

      // Notify the partner of the cancellation (records to
      // order_status_history + POSTs a signed CANCELLED webhook). Deferred
      // past the response so it never waits on the partner's server; a
      // failed send is retried from the durable queue. The helper
      // self-guards against legacy carriers and never throws.
      runAfterResponse('Failed to dispatch partner cancellation webhook:', () =>
        recordAndDispatchLifecycleEvent({
          orderId: cancelledOrder.id,
          orderNumber: cancelledOrder.orderNumber,
          partnerStatus: 'CANCELLED',
          notes: validatedData.reason,
        }),
      );

      return storeAndReturnResponse(idempotency, 200, {
        id: cancelledOrder.id,
        orderNumber: cancelledOrder.orderNumber,
        status: 'CANCELLED' as const,
        message: 'Order has been cancelled successfully',
      });
    }

    // The CONFIRMED history row is what keeps the order locked for the
    // partner once it is confirmed (return-to-dispatch resets the status to
    // ACTIVE), so it is written in the same transaction as the status: a
    // failed write fails the confirm (retryable) instead of leaving a
    // confirmed order unlocked. It is an internal event — no webhook.
    const confirmedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.cateringRequest.update({
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
      await tx.orderStatusHistory.create({
        data: {
          cateringRequestId: updated.id,
          partnerStatus: CONFIRMED_HISTORY_STATUS,
          driverStatus: null,
          changedBy: null,
        },
      });
      return updated;
    });

    await triggerOrderDispatch(confirmedOrder.id);

    // Admin notification on partner order confirmation. The draft was created
    // earlier (via /orders/draft) without notification — we notify only once
    // the partner explicitly confirms.
    runAfterResponse("admin-order-notification", () =>
      notifyOrderCreated({
        orderId: confirmedOrder.id,
        orderType: "catering",
        source: "partner_api",
      }),
    );

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
        expectedAssignmentTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        trackingAvailable: true,
      },
    };

    return storeAndReturnResponse(idempotency, 200, response);
  } catch (error) {
    console.error('Error confirming partner order:', error);

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
