import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/request-user';
import { prisma } from '@/utils/prismaDB';
import { returnOrderToDispatch } from '@/lib/state-machine/transition';
import { getPartnerByOrderNumber } from '@/lib/services/partner-registry';
import { sendDispatchStatusNotification } from '@/services/notifications/delivery-status';
import { runAfterResponse } from '@/lib/api/after-response';
import * as Sentry from '@sentry/nextjs';

/**
 * POST - Return an assigned delivery to the dispatch pool (issue #508).
 *
 * A driver who cannot complete an assigned delivery was previously deadlocked:
 * no driver-side hand-back existed and the end-shift guard blocks while the
 * assignment is live. This route unwinds the assignment in one transaction —
 * mirror tombstone, dispatch delete, order back to ACTIVE with driverStatus
 * cleared — then notifies dispatch (ADMIN push) after the response.
 *
 * AuthZ: the assigned driver may return pre-pickup only (409 POST_PICKUP
 * after); ADMIN / SUPER_ADMIN / HELPDESK may force a return in any
 * non-terminal state (HELPDESK-privileged mirrors the orders PATCH).
 */

const RETURN_REASONS = [
  'CANNOT_MAKE_PICKUP',
  'VEHICLE_ISSUE',
  'EMERGENCY',
  'STALE_ORDER',
  'ADMIN_UNASSIGNED',
  'OTHER',
] as const;
type ReturnReason = (typeof RETURN_REASONS)[number];

const MAX_DETAILS_LENGTH = 500;

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'];
const TERMINAL_ORDER_STATUSES = ['COMPLETED', 'CANCELLED'];
// Once the driver holds the food, a silent hand-back would strand the order —
// post-pickup returns must go through dispatch (admins can still force).
const POST_PICKUP_DRIVER_STATUSES = [
  'PICKED_UP',
  'EN_ROUTE_TO_CLIENT',
  'ARRIVED_TO_CLIENT',
  'COMPLETED',
];

/** Guard failure inside the transaction, mapped to an HTTP response. */
class ReturnGuardError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ReturnGuardError';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> },
) {
  try {
    const { order_number: encodedOrderNumber } = await params;
    const orderNumber = decodeURIComponent(encodedOrderNumber);

    // Authenticate user (Bearer token first, cookie session fallback)
    const user = await getRequestUser(request);

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const userProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, type: true },
    });

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 },
      );
    }

    const allowedRoles = ['DRIVER', ...PRIVILEGED_ROLES];
    if (!allowedRoles.includes(userProfile.type)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 },
      );
    }
    const isPrivileged = PRIVILEGED_ROLES.includes(userProfile.type);

    // Validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const reason = (body as { reason?: unknown } | null)?.reason;
    const detailsRaw = (body as { details?: unknown } | null)?.details;

    if (typeof reason !== 'string' || !RETURN_REASONS.includes(reason as ReturnReason)) {
      return NextResponse.json(
        { success: false, error: 'Select a valid reason for returning this delivery.' },
        { status: 400 },
      );
    }
    const details = typeof detailsRaw === 'string' ? detailsRaw.trim() : '';
    if (details.length > MAX_DETAILS_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Details are too long (max ${MAX_DETAILS_LENGTH} characters).` },
        { status: 400 },
      );
    }

    // Locate the order (catering first, then on-demand)
    let orderId: string | null = null;
    let orderType: 'catering' | 'on_demand' | null = null;

    const cateringRequest = await prisma.cateringRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true, orderNumber: true },
    });

    if (cateringRequest) {
      orderId = cateringRequest.id;
      orderType = 'catering';
    } else {
      const onDemandOrder = await prisma.onDemand.findFirst({
        where: {
          orderNumber: { equals: orderNumber, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true, orderNumber: true },
      });
      if (onDemandOrder) {
        orderId = onDemandOrder.id;
        orderType = 'on_demand';
      }
    }

    if (!orderId || !orderType) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 },
      );
    }

    const reasonNote = `Returned to dispatch (${reason})${details ? `: ${details}` : ''}`;

    let unwound: { dbOrderNumber: string; dispatchId: string | null };
    try {
      unwound = await prisma.$transaction(async (tx) => {
        // Fresh in-tx read: guards must see the current state so a concurrent
        // driver PATCH to PICKED_UP can't race past the pre-pickup check.
        const order =
          orderType === 'catering'
            ? await tx.cateringRequest.findFirst({
                where: { id: orderId!, deletedAt: null },
                select: { id: true, orderNumber: true, status: true, driverStatus: true },
              })
            : await tx.onDemand.findFirst({
                where: { id: orderId!, deletedAt: null },
                select: { id: true, orderNumber: true, status: true, driverStatus: true },
              });

        if (!order) {
          throw new ReturnGuardError(404, 'NOT_FOUND', 'Order not found');
        }
        if (TERMINAL_ORDER_STATUSES.includes(String(order.status))) {
          throw new ReturnGuardError(
            409,
            'TERMINAL',
            `Order is already ${String(order.status).toLowerCase()} and cannot be returned.`,
          );
        }

        const dispatches = await tx.dispatch.findMany({
          where:
            orderType === 'catering'
              ? { cateringRequestId: orderId! }
              : { onDemandId: orderId! },
          select: { id: true, driverId: true },
        });

        if (dispatches.length === 0) {
          throw new ReturnGuardError(
            409,
            'NOT_ASSIGNED',
            'This order is not assigned to a driver.',
          );
        }

        if (!isPrivileged) {
          const ownDispatch = dispatches.some((d) => d.driverId === user.id);
          if (!ownDispatch) {
            throw new ReturnGuardError(
              403,
              'NOT_YOUR_ORDER',
              'Access denied - not assigned to this order',
            );
          }
          if (POST_PICKUP_DRIVER_STATUSES.includes(String(order.driverStatus))) {
            throw new ReturnGuardError(
              409,
              'POST_PICKUP',
              'The order has already been picked up. Contact dispatch to hand it back.',
            );
          }
        }

        const now = new Date();

        // Tombstone the deliveries mirror: the admin SSE feed filters on live
        // lowercase statuses, so the row must be both CANCELLED and
        // soft-deleted to drop off every surface. The reason lands in
        // deliveryNotes (the model has no deletionReason column).
        await tx.delivery.updateMany({
          where: { orderNumber: order.orderNumber!, deletedAt: null },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            deletedAt: now,
            deliveryNotes: reasonNote,
          },
        });

        // Removing the dispatch rows unassigns the order — the driver feed,
        // the end-shift guard, and the admin map are all dispatch-keyed.
        const firstDispatchId = dispatches[0]?.id ?? null;
        await tx.dispatch.deleteMany({
          where:
            orderType === 'catering'
              ? { cateringRequestId: orderId! }
              : { onDemandId: orderId! },
        });

        // Order re-enters the assignable pool (ACTIVE, driverStatus cleared).
        await returnOrderToDispatch(tx, orderType!, orderId!);

        // Audit trail: catering non-partner orders only. order_status_history
        // FKs to catering_requests, and partner orders must not get a
        // lifecycle row the partner contract has no status for (never call
        // recordAndDispatchLifecycleEvent here — it fires partner webhooks).
        if (orderType === 'catering') {
          const partner = await getPartnerByOrderNumber(order.orderNumber!);
          if (!partner) {
            await tx.orderStatusHistory.create({
              data: {
                cateringRequestId: orderId!,
                partnerStatus: 'RETURNED_TO_DISPATCH',
                driverStatus: null,
                changedBy: user.id,
                notes: reasonNote,
              },
            });
          }
        }

        return { dbOrderNumber: order.orderNumber!, dispatchId: firstDispatchId };
      });
    } catch (err) {
      if (err instanceof ReturnGuardError) {
        return NextResponse.json(
          { success: false, error: err.message, code: err.code },
          { status: err.status },
        );
      }
      throw err;
    }

    // Notify dispatch after the response ("Delivery Failed - Action Required"
    // push to ADMIN/SUPER_ADMIN/HELPDESK — already part of criticalEvents).
    if (unwound.dispatchId) {
      const { dispatchId } = unwound;
      runAfterResponse('Failed to send return-to-dispatch notification:', () =>
        sendDispatchStatusNotification({
          status: 'FAILED',
          dispatchId,
          orderId: orderId!,
          recipientType: 'ADMIN',
        }),
      );
    }

    return NextResponse.json({
      success: true,
      orderNumber: unwound.dbOrderNumber,
      status: 'ACTIVE',
      message: 'Delivery returned to dispatch',
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'return_to_dispatch', route: 'orders' },
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to return the delivery to dispatch',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
