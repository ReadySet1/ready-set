// src/__tests__/api/orders/order-delete.test.ts
//
// DELETE /api/orders/delete (REA-342). The route is thin: admin auth,
// parameter validation, one call into the shared order-deletion service, and
// the response shape OrderHeader.tsx reads. What a delete actually does is
// covered by src/lib/services/__tests__/order-deletion.test.ts.

jest.mock('@/utils/prismaDB', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/services/order-deletion', () => ({
  ...jest.requireActual('@/lib/services/order-deletion'),
  softDeleteOrder: jest.fn(),
}));

import { NextResponse } from 'next/server';
import { DELETE } from '@/app/api/orders/delete/route';
import { withAuth } from '@/lib/auth-middleware';
import { softDeleteOrder } from '@/lib/services/order-deletion';
import {
  createDeleteRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

const mockedWithAuth = withAuth as jest.Mock;
const mockedSoftDelete = softDeleteOrder as jest.Mock;

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const DELETED_AT = new Date('2026-10-06T12:00:00.000Z');
const URL_BASE = 'http://localhost:3000/api/orders/delete';

const authAs = (type: string, id = ADMIN_ID) => ({
  success: true,
  context: { user: { id, email: 'admin@rs.com', type } },
});
const authRejected = (status: number, error: string) => ({
  success: false,
  response: NextResponse.json({ error }, { status }),
  context: {},
});

const deleted = (overrides: Record<string, unknown> = {}) => ({
  outcome: 'DELETED',
  orderType: 'catering',
  orderId: ORDER_ID,
  orderNumber: 'CAT-001',
  deletedAt: DELETED_AT,
  deletedBy: ADMIN_ID,
  deletedDispatches: 2,
  deletedFiles: 1,
  orphanedFiles: [],
  ...overrides,
});

describe('DELETE /api/orders/delete - Delete Order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWithAuth.mockResolvedValue(authAs('ADMIN'));
    mockedSoftDelete.mockResolvedValue(deleted());
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful soft delete', () => {
    it('soft-deletes a catering order and reports deletedAt / deletedBy', async () => {
      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );
      const data = await expectSuccessResponse(response, 200);

      expect(mockedSoftDelete).toHaveBeenCalledWith(
        { orderType: 'catering', orderId: ORDER_ID },
        { deletedBy: ADMIN_ID, reason: null },
      );
      expect(data.success).toBe(true);
      expect(data.message).toMatch(/deleted successfully/i);
      expect(data.details).toEqual({
        deletedOrder: 1,
        orderId: ORDER_ID,
        orderNumber: 'CAT-001',
        deletedAt: DELETED_AT.toISOString(),
        deletedBy: ADMIN_ID,
        deletedDispatches: 2,
        deletedFiles: 1,
        orphanedFiles: [],
      });
    });

    it('maps orderType=onDemand to the on-demand table', async () => {
      mockedSoftDelete.mockResolvedValue(deleted({ orderType: 'on_demand', orderNumber: 'OD-002' }));

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=onDemand`),
      );
      const data = await expectSuccessResponse(response, 200);

      expect(mockedSoftDelete).toHaveBeenCalledWith(
        { orderType: 'on_demand', orderId: ORDER_ID },
        expect.objectContaining({ deletedBy: ADMIN_ID }),
      );
      expect(data.success).toBe(true);
    });

    it('passes an optional deletion reason through', async () => {
      await DELETE(
        createDeleteRequest(
          `${URL_BASE}?orderId=${ORDER_ID}&orderType=catering&reason=Duplicate%20order`,
        ),
      );

      expect(mockedSoftDelete).toHaveBeenCalledWith(expect.anything(), {
        deletedBy: ADMIN_ID,
        reason: 'Duplicate order',
      });
    });
  });

  describe('Files left behind in storage', () => {
    it('does not report full success when a storage object could not be removed', async () => {
      const orphan = {
        fileId: 'file-1',
        fileName: 'menu.pdf',
        bucket: 'fileUploader',
        paths: ['orders/catering/x/menu.pdf'],
        reason: 'REMOVE_FAILED',
        detail: 'permission denied',
      };
      mockedSoftDelete.mockResolvedValue(deleted({ orphanedFiles: [orphan] }));

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(false);
      expect(data.partial).toBe(true);
      expect(data.error).toMatch(/1 file could not be removed from storage/i);
      expect(data.details.deletedOrder).toBe(1);
      expect(data.details.orphanedFiles).toEqual([orphan]);
    });
  });

  describe('Authentication and authorization', () => {
    it('requires ADMIN or SUPER_ADMIN through withAuth', async () => {
      await DELETE(createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`));

      expect(mockedWithAuth).toHaveBeenCalledWith(expect.anything(), {
        allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
        requireAuth: true,
      });
    });

    it('returns 401 for unauthenticated requests and deletes nothing', async () => {
      mockedWithAuth.mockResolvedValue(authRejected(401, 'Authentication required'));

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );

      const data = await expectUnauthorized(response, /Unauthorized.*logged in/i);
      expect(data.success).toBe(false);
      expect(mockedSoftDelete).not.toHaveBeenCalled();
    });

    it('returns 403 when withAuth rejects the caller role and deletes nothing', async () => {
      mockedWithAuth.mockResolvedValue(authRejected(403, 'Insufficient permissions'));

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );

      const data = await expectForbidden(response, /Only administrators can delete orders/i);
      expect(data.success).toBe(false);
      expect(mockedSoftDelete).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it.each([
      ['orderId', `${URL_BASE}?orderType=catering`],
      ['orderType', `${URL_BASE}?orderId=${ORDER_ID}`],
      ['both parameters', URL_BASE],
    ])('returns 400 when %s is missing', async (_label, url) => {
      const response = await DELETE(createDeleteRequest(url));

      await expectErrorResponse(response, 400, /Missing required parameters/i);
      expect(mockedSoftDelete).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid orderType', async () => {
      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=invalid`),
      );

      await expectErrorResponse(response, 400, /Invalid orderType.*Must be 'catering' or 'onDemand'/i);
      expect(mockedSoftDelete).not.toHaveBeenCalled();
    });
  });

  describe('Missing and already-deleted orders', () => {
    it('returns 404 when the order does not exist', async () => {
      mockedSoftDelete.mockResolvedValue({ outcome: 'NOT_FOUND' });

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );

      const data = await expectErrorResponse(response, 404, /not found/i);
      expect(data.success).toBe(false);
    });

    it('returns 409 when the order was already deleted', async () => {
      mockedSoftDelete.mockResolvedValue({
        outcome: 'ALREADY_DELETED',
        orderType: 'catering',
        orderId: ORDER_ID,
        orderNumber: 'CAT-001',
      });

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );

      const data = await expectErrorResponse(response, 409, /already been deleted/i);
      expect(data.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('returns 500 without leaking details when the service throws', async () => {
      mockedSoftDelete.mockRejectedValue(new Error('connection reset by peer'));

      const response = await DELETE(
        createDeleteRequest(`${URL_BASE}?orderId=${ORDER_ID}&orderType=catering`),
      );

      const data = await expectErrorResponse(response, 500, /error occurred while deleting/i);
      expect(data.success).toBe(false);
      expect(JSON.stringify(data)).not.toMatch(/connection reset/);
    });
  });
});
