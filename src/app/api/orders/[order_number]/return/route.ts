import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/utils/supabase/request-user';
import { prisma } from '@/utils/prismaDB';
import {
  RETURN_REASONS,
  MAX_RETURN_DETAILS_LENGTH,
  ReturnGuardError,
  buildReturnReasonNote,
  createReturnRequest,
  executeReturnToDispatch,
  loadReturnableOrder,
  type ReturnOrderType,
  type ReturnReason,
} from '@/lib/services/return-requests';
import { sendDispatchStatusNotification } from '@/services/notifications/delivery-status';
import { runAfterResponse } from '@/lib/api/after-response';
import * as Sentry from '@sentry/nextjs';

/**
 * Return an assigned delivery to the dispatch pool (issue #508), now with a
 * helpdesk-approval step for drivers:
 *
 * - ADMIN / SUPER_ADMIN / HELPDESK: unchanged immediate return — the
 *   assignment unwinds in one transaction (mirror tombstone, dispatch delete,
 *   order back to ACTIVE with driverStatus cleared).
 * - DRIVER: files a PENDING DeliveryReturnRequest (202) that dispatch reviews
 *   in the tracking dashboard. The driver keeps working the delivery while it
 *   is pending; advancing past pickup auto-voids the request. A pending
 *   request stops the order from blocking end-shift.
 *
 * GET returns the caller's pending request for the order so the driver UI can
 * render the "Return requested" state.
 */

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'];

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
    if (details.length > MAX_RETURN_DETAILS_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Details are too long (max ${MAX_RETURN_DETAILS_LENGTH} characters).` },
        { status: 400 },
      );
    }

    // Locate the order (catering first, then on-demand)
    let orderId: string | null = null;
    let orderType: ReturnOrderType | null = null;

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

    // ------------------------------------------------------------------
    // DRIVER path: file a return request for dispatch review (202).
    // ------------------------------------------------------------------
    if (!isPrivileged) {
      let requestResult;
      try {
        requestResult = await createReturnRequest({
          orderType,
          orderId,
          driverId: user.id,
          reason: reason as ReturnReason,
          details: details || undefined,
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

      // Push the action-required request to dispatch after the response —
      // only on first creation, never on an idempotent repeat.
      if (requestResult.created && requestResult.dispatchId) {
        const { dispatchId } = requestResult;
        const notifyOrderId = orderId;
        runAfterResponse('Failed to send return-request notification:', () =>
          sendDispatchStatusNotification({
            status: 'RETURN_REQUESTED',
            dispatchId,
            orderId: notifyOrderId,
            recipientType: 'ADMIN',
          }),
        );
      }

      return NextResponse.json(
        {
          success: true,
          status: 'PENDING_APPROVAL',
          requestId: requestResult.request.id,
          orderNumber: requestResult.request.orderNumber,
          alreadyPending: !requestResult.created,
          message: 'Return requested — dispatch will review it.',
        },
        { status: 202 },
      );
    }

    // ------------------------------------------------------------------
    // Privileged path: unchanged immediate return.
    // ------------------------------------------------------------------
    const reasonNote = buildReturnReasonNote(reason, details || null);

    let unwound: { dbOrderNumber: string; dispatchId: string | null };
    try {
      unwound = await prisma.$transaction(async (tx) => {
        // Fresh in-tx read: guards must see the current state (404 / TERMINAL).
        const order = await loadReturnableOrder(tx, orderType!, orderId!);

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

        const firstDispatchId = dispatches[0]?.id ?? null;

        await executeReturnToDispatch(tx, {
          orderType: orderType!,
          orderId: orderId!,
          dbOrderNumber: order.orderNumber!,
          reasonNote,
          changedBy: user.id,
        });

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

/**
 * GET - The caller's PENDING return request for this order (or null).
 * Drivers only see their own request; privileged roles see any pending one.
 * Smallest surface for the driver UI's "Return requested" state.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ order_number: string }> },
) {
  try {
    const { order_number: encodedOrderNumber } = await params;
    const orderNumber = decodeURIComponent(encodedOrderNumber);

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

    const pending = await prisma.deliveryReturnRequest.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        status: 'PENDING',
        ...(isPrivileged ? {} : { driverId: user.id }),
      },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        status: true,
        reason: true,
        details: true,
        requestedAt: true,
      },
    });

    return NextResponse.json({ success: true, request: pending ?? null });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'return_request_lookup', route: 'orders' },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to look up the return request' },
      { status: 500 },
    );
  }
}
