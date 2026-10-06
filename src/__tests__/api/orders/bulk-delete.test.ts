// src/__tests__/api/orders/bulk-delete.test.ts
//
// POST /api/orders/bulk-delete (REA-343). The route is thin: admin auth, body
// validation, one call into the shared order-deletion service, and a summary
// with one result per requested order. What a delete actually does (soft
// delete, bucket, path, orphans) is covered by
// src/lib/services/__tests__/order-deletion.test.ts.

jest.mock('@/utils/prismaDB', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(),
}));
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/services/order-deletion', () => ({
  ...jest.requireActual('@/lib/services/order-deletion'),
  softDeleteOrders: jest.fn(),
}));

import { NextResponse } from 'next/server';
import { POST } from '@/app/api/orders/bulk-delete/route';
import { withAuth } from '@/lib/auth-middleware';
import { softDeleteOrders } from '@/lib/services/order-deletion';
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

const mockedWithAuth = withAuth as jest.Mock;
const mockedSoftDeleteOrders = softDeleteOrders as jest.Mock;

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const DELETED_AT = new Date('2026-10-06T12:00:00.000Z');
const URL = 'http://localhost:3000/api/orders/bulk-delete';

const authAs = (type: string, id = ADMIN_ID) => ({
  success: true,
  context: { user: { id, email: 'admin@rs.com', type } },
});
const authRejected = (status: number, error: string) => ({
  success: false,
  response: NextResponse.json({ error }, { status }),
  context: {},
});

const deleted = (orderNumber: string, overrides: Record<string, unknown> = {}) => ({
  outcome: 'DELETED',
  orderType: 'catering',
  orderId: `id-${orderNumber}`,
  orderNumber,
  deletedAt: DELETED_AT,
  deletedBy: ADMIN_ID,
  deletedDispatches: 1,
  deletedFiles: 0,
  orphanedFiles: [],
  ...overrides,
});

describe('POST /api/orders/bulk-delete - Bulk Delete Orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWithAuth.mockResolvedValue(authAs('SUPER_ADMIN'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful bulk soft delete', () => {
    it('soft-deletes every order and summarises them with deletedAt', async () => {
      mockedSoftDeleteOrders.mockResolvedValue([deleted('CATER-001'), deleted('OD-002', { orderType: 'on_demand' })]);

      const response = await POST(createPostRequest(URL, { orderNumbers: ['CATER-001', 'OD-002'] }));
      const data = await expectSuccessResponse(response, 200);

      expect(mockedSoftDeleteOrders).toHaveBeenCalledWith(['CATER-001', 'OD-002'], {
        deletedBy: ADMIN_ID,
        reason: null,
      });
      expect(data.success).toBe(true);
      expect(data.summary).toEqual({
        requested: 2,
        deleted: 2,
        alreadyDeleted: 0,
        notFound: 0,
        failed: 0,
        orphanedFiles: 0,
      });
      // Fields BulkDeleteOrders.tsx reads.
      expect(data.results.deleted).toEqual(['CATER-001', 'OD-002']);
      expect(data.results.failed).toEqual([]);
      expect(data.results.orders).toEqual([
        expect.objectContaining({
          orderNumber: 'CATER-001',
          outcome: 'DELETED',
          orderType: 'catering',
          deletedAt: DELETED_AT.toISOString(),
          deletedBy: ADMIN_ID,
        }),
        expect.objectContaining({
          orderNumber: 'OD-002',
          outcome: 'DELETED',
          orderType: 'on_demand',
          deletedAt: DELETED_AT.toISOString(),
        }),
      ]);
    });

    it('passes an optional deletion reason through', async () => {
      mockedSoftDeleteOrders.mockResolvedValue([deleted('CATER-001')]);

      await POST(createPostRequest(URL, { orderNumbers: ['CATER-001'], reason: ' Test data ' }));

      expect(mockedSoftDeleteOrders).toHaveBeenCalledWith(['CATER-001'], {
        deletedBy: ADMIN_ID,
        reason: 'Test data',
      });
    });
  });

  describe('Mixed results', () => {
    it('reports each order: deleted, already deleted, missing and failed', async () => {
      mockedSoftDeleteOrders.mockResolvedValue([
        deleted('CATER-001'),
        { outcome: 'ALREADY_DELETED', orderType: 'catering', orderId: 'id-2', orderNumber: 'CATER-002' },
        { outcome: 'NOT_FOUND', orderNumber: 'CATER-003' },
        { outcome: 'FAILED', orderNumber: 'CATER-004', reason: 'connection reset by peer' },
      ]);

      const response = await POST(
        createPostRequest(URL, {
          orderNumbers: ['CATER-001', 'CATER-002', 'CATER-003', 'CATER-004'],
        }),
      );
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(false);
      expect(data.summary).toEqual({
        requested: 4,
        deleted: 1,
        alreadyDeleted: 1,
        notFound: 1,
        failed: 1,
        orphanedFiles: 0,
      });
      expect(data.results.deleted).toEqual(['CATER-001']);
      expect(data.results.failed).toEqual([
        { orderNumber: 'CATER-002', code: 'ALREADY_DELETED', reason: 'Order was already deleted' },
        { orderNumber: 'CATER-003', code: 'NOT_FOUND', reason: 'Order not found in database' },
        { orderNumber: 'CATER-004', code: 'FAILED', reason: 'Unexpected error while deleting the order' },
      ]);
      // Internal error text stays in the server log.
      expect(JSON.stringify(data)).not.toMatch(/connection reset/);
    });
  });

  describe('Files left behind in storage', () => {
    it('does not report full success and lists every orphan with its order', async () => {
      const orphan = {
        fileId: 'file-1',
        fileName: 'menu.pdf',
        bucket: 'fileUploader',
        paths: ['orders/catering/x/menu.pdf'],
        reason: 'REMOVE_FAILED',
        detail: 'permission denied',
      };
      mockedSoftDeleteOrders.mockResolvedValue([
        deleted('CATER-001', { deletedFiles: 1, orphanedFiles: [orphan] }),
        deleted('CATER-002'),
      ]);

      const response = await POST(
        createPostRequest(URL, { orderNumbers: ['CATER-001', 'CATER-002'] }),
      );
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(false);
      expect(data.summary).toMatchObject({ deleted: 2, failed: 0, orphanedFiles: 1 });
      expect(data.message).toMatch(/1 file could not be removed from storage/i);
      // The orders themselves are deleted; only their files need attention.
      expect(data.results.deleted).toEqual(['CATER-001', 'CATER-002']);
      expect(data.results.orphanedFiles).toEqual([{ orderNumber: 'CATER-001', ...orphan }]);
    });
  });

  describe('Authentication and authorization', () => {
    it('requires ADMIN or SUPER_ADMIN through withAuth', async () => {
      mockedSoftDeleteOrders.mockResolvedValue([deleted('CATER-001')]);

      await POST(createPostRequest(URL, { orderNumbers: ['CATER-001'] }));

      expect(mockedWithAuth).toHaveBeenCalledWith(expect.anything(), {
        allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
        requireAuth: true,
      });
    });

    it('returns 401 for unauthenticated requests and deletes nothing', async () => {
      mockedWithAuth.mockResolvedValue(authRejected(401, 'Authentication required'));

      const response = await POST(createPostRequest(URL, { orderNumbers: ['CATER-001'] }));

      await expectUnauthorized(response, /Unauthorized - Must be signed in/i);
      expect(mockedSoftDeleteOrders).not.toHaveBeenCalled();
    });

    it('returns 403 when withAuth rejects the caller role and deletes nothing', async () => {
      mockedWithAuth.mockResolvedValue(authRejected(403, 'Insufficient permissions'));

      const response = await POST(createPostRequest(URL, { orderNumbers: ['CATER-001'] }));

      await expectForbidden(response, /Forbidden - Admin permissions required/i);
      expect(mockedSoftDeleteOrders).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it.each([
      ['missing', {}],
      ['not an array', { orderNumbers: 'CATER-001' }],
      ['empty', { orderNumbers: [] }],
      ['holding a non-string', { orderNumbers: ['CATER-001', 42] }],
      ['holding a blank string', { orderNumbers: ['CATER-001', '  '] }],
    ])('returns 400 when orderNumbers is %s', async (_label, body) => {
      const response = await POST(createPostRequest(URL, body));

      await expectErrorResponse(response, 400, /Invalid request format.*Expected an array of order numbers/i);
      expect(mockedSoftDeleteOrders).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('returns 500 without leaking details when the service throws', async () => {
      mockedSoftDeleteOrders.mockRejectedValue(new Error('connection reset by peer'));

      const response = await POST(createPostRequest(URL, { orderNumbers: ['CATER-001'] }));

      const data = await expectErrorResponse(response, 500, /Error occurred during bulk order deletion/i);
      expect(JSON.stringify(data)).not.toMatch(/connection reset/);
    });
  });
});
