import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { softDeleteOrder } from '@/lib/services/order-deletion';

const MAX_REASON_LENGTH = 500;

/**
 * DELETE /api/orders/delete?orderId=&orderType=catering|onDemand[&reason=]
 *
 * Admin-only soft delete of one order (REA-342). The order row is kept with
 * deletedAt / deletedBy stamped and its files are retained; what else a
 * delete covers lives in src/lib/services/order-deletion.ts.
 */
export async function DELETE(req: NextRequest) {
  const auth = await withAuth(req, {
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    requireAuth: true,
  });
  if (!auth.success) {
    const status = auth.response?.status ?? 401;
    const error =
      status === 401
        ? 'Unauthorized: You must be logged in to perform this action.'
        : status === 403
          ? 'Unauthorized: Only administrators can delete orders.'
          : 'Authentication error. Please try again.';
    return NextResponse.json({ success: false, error }, { status });
  }

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  const orderType = searchParams.get('orderType');
  const reason = searchParams.get('reason')?.trim().slice(0, MAX_REASON_LENGTH) || null;

  if (!orderId || !orderType) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameters: orderId or orderType' },
      { status: 400 },
    );
  }
  if (orderType !== 'catering' && orderType !== 'onDemand') {
    return NextResponse.json(
      {
        success: false,
        error: `Invalid orderType: ${orderType}. Must be 'catering' or 'onDemand'.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await softDeleteOrder(
      { orderType: orderType === 'catering' ? 'catering' : 'on_demand', orderId },
      { deletedBy: auth.context.user.id, reason },
    );

    if (result.outcome === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: `Order with ID ${orderId} not found.` },
        { status: 404 },
      );
    }
    if (result.outcome === 'ALREADY_DELETED') {
      return NextResponse.json(
        { success: false, error: `Order ${result.orderNumber} has already been deleted.` },
        { status: 409 },
      );
    }

    const details = {
      deletedOrder: 1,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      deletedAt: result.deletedAt.toISOString(),
      deletedBy: result.deletedBy,
      deletedDispatches: result.deletedDispatches,
    };

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
      details,
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred while deleting the order. Please try again.',
      },
      { status: 500 },
    );
  }
}
