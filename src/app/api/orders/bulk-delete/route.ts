import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { softDeleteOrders } from '@/lib/services/order-deletion';

const MAX_REASON_LENGTH = 500;

const FAILURE_REASONS = {
  ALREADY_DELETED: 'Order was already deleted',
  NOT_FOUND: 'Order not found in database',
  // The underlying error is logged by the service, not sent to the browser.
  FAILED: 'Unexpected error while deleting the order',
} as const;

type FailureCode = keyof typeof FAILURE_REASONS;

/**
 * POST /api/orders/bulk-delete  { orderNumbers: string[], reason?: string }
 *
 * Admin-only soft delete of several orders (REA-343). Always answers 200 with
 * one result per requested order; `success` is true only when no order
 * FAILED (an order that was missing or already deleted is reported, not a
 * failure of the batch). What a delete covers lives in
 * src/lib/services/order-deletion.ts.
 */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req, {
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) {
    const status = auth.response?.status ?? 401;
    const message =
      status === 401
        ? 'Unauthorized - Must be signed in'
        : status === 403
          ? 'Forbidden - Admin permissions required'
          : 'Authentication error';
    return NextResponse.json({ message }, { status });
  }

  try {
    const body = await req.json().catch(() => null);
    const orderNumbers: unknown = body?.orderNumbers;

    if (
      !Array.isArray(orderNumbers) ||
      orderNumbers.length === 0 ||
      !orderNumbers.every((n): n is string => typeof n === 'string' && n.trim() !== '')
    ) {
      return NextResponse.json(
        { message: 'Invalid request format. Expected an array of order numbers.' },
        { status: 400 },
      );
    }

    const reason =
      typeof body.reason === 'string'
        ? body.reason.trim().slice(0, MAX_REASON_LENGTH) || null
        : null;

    const outcomes = await softDeleteOrders(orderNumbers, {
      deletedBy: auth.context.user.id,
      reason,
    });

    const deleted: string[] = [];
    const failed: { orderNumber: string; code: FailureCode; reason: string }[] = [];

    const orders = outcomes.map((outcome) => {
      const { orderNumber } = outcome;
      if (outcome.outcome !== 'DELETED') {
        failed.push({
          orderNumber,
          code: outcome.outcome,
          reason: FAILURE_REASONS[outcome.outcome],
        });
        return { orderNumber, outcome: outcome.outcome };
      }

      deleted.push(orderNumber);
      return {
        orderNumber,
        outcome: outcome.outcome,
        orderId: outcome.orderId,
        orderType: outcome.orderType,
        deletedAt: outcome.deletedAt.toISOString(),
        deletedBy: outcome.deletedBy,
        deletedDispatches: outcome.deletedDispatches,
      };
    });

    const countFailed = (code: FailureCode) => failed.filter((f) => f.code === code).length;

    return NextResponse.json({
      success: countFailed('FAILED') === 0,
      message: `Bulk deletion attempted. ${deleted.length} orders deleted, ${failed.length} failed.`,
      summary: {
        requested: outcomes.length,
        deleted: deleted.length,
        alreadyDeleted: countFailed('ALREADY_DELETED'),
        notFound: countFailed('NOT_FOUND'),
        failed: countFailed('FAILED'),
      },
      results: { deleted, failed, orders },
    });
  } catch (error) {
    console.error('Fatal Error in bulk order deletion API:', error);
    return NextResponse.json(
      { message: 'Error occurred during bulk order deletion process.' },
      { status: 500 },
    );
  }
}
