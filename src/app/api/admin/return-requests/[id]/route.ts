import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import {
  ReturnGuardError,
  approveReturnRequest,
  rejectReturnRequest,
  MAX_RETURN_DETAILS_LENGTH,
} from '@/lib/services/return-requests';
import { sendDeliveryStatusPush } from '@/services/notifications/push';
import { runAfterResponse } from '@/lib/api/after-response';
import * as Sentry from '@sentry/nextjs';

/**
 * PATCH - Resolve a driver return request. ADMIN / SUPER_ADMIN / HELPDESK.
 *
 * Body: { action: 'approve' | 'reject', notes?: string }
 *
 * - approve: re-checks the order is still returnable and runs the shared
 *   return-to-dispatch unwind. If the order moved on (advanced past pickup,
 *   reassigned, terminal), the request is VOIDED instead and the response
 *   says so — the panel should treat that as "nothing left to do".
 * - reject: marks the request REJECTED; the assignment stays untouched.
 *
 * The requesting driver gets a push on either resolution (best-effort,
 * after the response).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const authResult = await withAuth(request, {
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
      requireAuth: true,
    });
    if (!authResult.success) {
      return authResult.response;
    }
    const resolverId = authResult.context.user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const action = (body as { action?: unknown } | null)?.action;
    const notesRaw = (body as { notes?: unknown } | null)?.notes;
    const notes = typeof notesRaw === 'string' ? notesRaw.trim() : '';

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: "Action must be 'approve' or 'reject'." },
        { status: 400 },
      );
    }
    if (notes.length > MAX_RETURN_DETAILS_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Notes are too long (max ${MAX_RETURN_DETAILS_LENGTH} characters).` },
        { status: 400 },
      );
    }

    try {
      if (action === 'approve') {
        const result = await approveReturnRequest(id, resolverId);

        if (result.outcome === 'VOIDED') {
          // The world moved on since the driver asked; nothing was returned.
          return NextResponse.json({
            success: true,
            status: 'VOIDED',
            reason: result.reason,
            message:
              'This request no longer applies — the order has moved on since the driver asked.',
          });
        }

        const { driverId, orderId, orderNumber } = result;
        runAfterResponse('Failed to send return-approved push:', () =>
          sendDeliveryStatusPush({
            profileId: driverId,
            event: 'delivery:return_approved',
            orderId,
            orderNumber,
          }),
        );

        return NextResponse.json({
          success: true,
          status: 'APPROVED',
          orderNumber,
          message: 'Return approved — the order is back in the dispatch pool.',
        });
      }

      const rejected = await rejectReturnRequest(id, resolverId, notes || undefined);
      runAfterResponse('Failed to send return-rejected push:', () =>
        sendDeliveryStatusPush({
          profileId: rejected.driverId,
          event: 'delivery:return_rejected',
          orderId: rejected.orderId,
          orderNumber: rejected.orderNumber,
        }),
      );

      return NextResponse.json({
        success: true,
        status: 'REJECTED',
        orderNumber: rejected.orderNumber,
        message: 'Return request rejected — the delivery stays with the driver.',
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
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'return_request_resolve', route: 'admin' },
    });
    return NextResponse.json(
      { success: false, error: 'Failed to resolve the return request' },
      { status: 500 },
    );
  }
}
