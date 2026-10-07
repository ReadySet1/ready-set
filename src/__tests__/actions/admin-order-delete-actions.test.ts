/**
 * deleteCateringOrder / deleteOnDemandOrder server actions (the trash button
 * in the admin order tables). Both used to hard-delete on their own; they now
 * authorise the caller and hand off to the shared order-deletion service.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/utils/prismaDB', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));
jest.mock('@/lib/auth/staff-caller', () => ({ getStaffCaller: jest.fn() }));
jest.mock('@/lib/auth/driver-ownership', () => ({ getActionCaller: jest.fn() }));
jest.mock('@/services/orders/notifyOrderCreated');
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/services/order-deletion', () => ({
  ...jest.requireActual('@/lib/services/order-deletion'),
  softDeleteOrder: jest.fn(),
}));

import { revalidatePath } from 'next/cache';
import { getActionCaller } from '@/lib/auth/driver-ownership';
import { softDeleteOrder } from '@/lib/services/order-deletion';
import { deleteCateringOrder } from '@/app/(backend)/admin/catering-orders/_actions/catering-orders';
import { deleteOnDemandOrder } from '@/app/(backend)/admin/on-demand-orders/_actions/on-demand-orders';

const mockedCaller = getActionCaller as jest.Mock;
const mockedSoftDelete = softDeleteOrder as jest.Mock;
const mockedRevalidate = revalidatePath as jest.Mock;

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const deleted = (overrides: Record<string, unknown> = {}) => ({
  outcome: 'DELETED',
  orderType: 'catering',
  orderId: ORDER_ID,
  orderNumber: 'CAT 001',
  deletedAt: new Date('2026-10-06T12:00:00.000Z'),
  deletedBy: ADMIN_ID,
  deletedDispatches: 1,
  ...overrides,
});

describe.each([
  ['deleteCateringOrder', deleteCateringOrder, 'catering', '/admin/catering-orders'],
  ['deleteOnDemandOrder', deleteOnDemandOrder, 'on_demand', '/admin/on-demand-orders'],
] as const)('%s', (_name, action, orderType, listPath) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCaller.mockResolvedValue({ userId: ADMIN_ID, isPrivileged: true });
    mockedSoftDelete.mockResolvedValue(deleted({ orderType }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('soft-deletes through the shared service as the calling admin', async () => {
    const result = await action(ORDER_ID);

    expect(mockedSoftDelete).toHaveBeenCalledWith(
      { orderType, orderId: ORDER_ID },
      { deletedBy: ADMIN_ID },
    );
    expect(result).toEqual({ success: true, message: 'Order deleted successfully' });
    expect(mockedRevalidate).toHaveBeenCalledWith(listPath);
    expect(mockedRevalidate).toHaveBeenCalledWith(`${listPath}/CAT%20001`);
  });

  it('rejects an unauthenticated caller without deleting', async () => {
    mockedCaller.mockResolvedValue(null);

    const result = await action(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/must be logged in/i);
    expect(mockedSoftDelete).not.toHaveBeenCalled();
  });

  it('rejects a non-admin caller without deleting', async () => {
    mockedCaller.mockResolvedValue({ userId: 'helpdesk-1', isPrivileged: false });

    const result = await action(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Only Admin or Super Admin can delete/i);
    expect(mockedSoftDelete).not.toHaveBeenCalled();
  });

  it('reports a missing order', async () => {
    mockedSoftDelete.mockResolvedValue({ outcome: 'NOT_FOUND' });

    expect(await action(ORDER_ID)).toEqual({
      success: false,
      error: `Order with ID ${ORDER_ID} not found.`,
    });
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('reports an order that was already deleted', async () => {
    mockedSoftDelete.mockResolvedValue({
      outcome: 'ALREADY_DELETED',
      orderType,
      orderId: ORDER_ID,
      orderNumber: 'CAT 001',
    });

    const result = await action(ORDER_ID);

    expect(result).toEqual({
      success: false,
      error: 'Order CAT 001 has already been deleted.',
    });
  });

  it('returns a generic error when the service throws', async () => {
    mockedSoftDelete.mockRejectedValue(new Error('connection reset by peer'));

    const result = await action(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/^Database error: Failed to delete/);
    expect(result.error).not.toMatch(/connection reset/);
  });
});
