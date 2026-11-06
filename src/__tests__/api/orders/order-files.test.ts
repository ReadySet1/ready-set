// src/__tests__/api/orders/order-files.test.ts

import { GET } from '@/app/api/orders/[order_number]/files/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { UserType } from '@/types/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findFirst: jest.fn(),
    },
    onDemand: {
      findFirst: jest.fn(),
    },
    dispatch: {
      findFirst: jest.fn(),
    },
    fileUpload: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

// The route authenticates through the real `withAuth()` middleware, which
// resolves the role via `getUserRole()`; only the role lookup is mocked so the
// Bearer-first / cookie-fallback logic is exercised for real.
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));

const mockGetUser = jest.fn();
const mockGetUserRole = getUserRole as jest.Mock;

const NO_SESSION = {
  data: { user: null },
  error: { message: 'Auth session missing!' },
};

/** Cookie session: `getUser()` resolves the user whether or not a token is passed. */
function signInViaCookie(id: string, role: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id } }, error: null });
  mockGetUserRole.mockResolvedValue(role);
}

/**
 * Bearer-only session, as the native wrapper apps send it: there is no cookie,
 * so a bare `getUser()` finds nothing and only `getUser(<token>)` resolves.
 */
function signInViaBearerOnly(id: string, role: string, token: string) {
  mockGetUser.mockImplementation(async (maybeToken?: string) =>
    maybeToken === token
      ? { data: { user: { id } }, error: null }
      : NO_SESSION,
  );
  mockGetUserRole.mockResolvedValue(role);
}

function signedOut() {
  mockGetUser.mockResolvedValue(NO_SESSION);
  mockGetUserRole.mockResolvedValue(null);
}

describe('GET /api/orders/[order_number]/files - Fetch Order Files', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: mockGetUser,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Fetch', () => {
    it('should fetch files for catering order by order owner', async () => {
      signInViaCookie('user-123', UserType.CLIENT);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      const mockFiles = [
        {
          id: 'file-1',
          fileName: 'invoice.pdf',
          fileUrl: 'https://storage.example.com/invoice.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          category: 'catering-order',
          uploadedAt: new Date('2024-01-15T10:00:00Z'),
          cateringRequestId: 'order-1',
        },
        {
          id: 'file-2',
          fileName: 'receipt.jpg',
          fileUrl: 'https://storage.example.com/receipt.jpg',
          fileType: 'image/jpeg',
          fileSize: 2048,
          category: 'catering-order',
          uploadedAt: new Date('2024-01-10T10:00:00Z'),
          cateringRequestId: 'order-1',
        },
      ];

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveLength(2);
      expect(data[0].fileName).toBe('invoice.pdf');
      expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
        where: {
          OR: expect.any(Array),
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 100,
      });
    });

    it('should fetch files for on-demand order by ADMIN', async () => {
      signInViaCookie('admin-456', UserType.ADMIN);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-2',
        userId: 'user-789',
      });

      const mockFiles = [
        {
          id: 'file-3',
          fileName: 'order.pdf',
          fileUrl: 'https://storage.example.com/order.pdf',
          fileType: 'application/pdf',
          fileSize: 512,
          category: 'on-demand',
          uploadedAt: new Date('2024-01-20T14:00:00Z'),
          onDemandId: 'order-2',
        },
      ];

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

      const request = createGetRequest('http://localhost:3000/api/orders/OD-002/files');
      const params = { order_number: 'OD-002' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveLength(1);
      expect(data[0].fileName).toBe('order.pdf');
    });

    it('should fetch files by SUPER_ADMIN', async () => {
      signInViaCookie('superadmin-123', UserType.SUPER_ADMIN);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveLength(0);
    });

    it('should fetch files by HELPDESK', async () => {
      signInViaCookie('helpdesk-123', UserType.HELPDESK);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectSuccessResponse(response, 200);
    });

    it('should fetch files for the driver dispatched to the order', async () => {
      signInViaCookie('driver-123', UserType.DRIVER);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue({ id: 'dispatch-1' });
      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectSuccessResponse(response, 200);
      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith({
        where: { driverId: 'driver-123', cateringRequestId: 'order-1' },
        select: { id: true },
      });
    });

    it('should return empty array when order has no files', async () => {
      signInViaCookie('user-123', UserType.CLIENT);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toEqual([]);
    });

    it('should handle case-insensitive order number', async () => {
      signInViaCookie('user-123', UserType.CLIENT);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/cater-001/files');
      const params = { order_number: 'cater-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectSuccessResponse(response, 200);
      expect(prisma.cateringRequest.findFirst).toHaveBeenCalledWith({
        where: {
          orderNumber: {
            equals: 'cater-001',
            mode: 'insensitive',
          },
        },
        select: expect.any(Object),
      });
    });

    it('should handle URL encoded order number', async () => {
      signInViaCookie('user-123', UserType.CLIENT);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER%2D001/files');
      const params = { order_number: 'CATER%2D001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectSuccessResponse(response, 200);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when the request carries no credentials', async () => {
      signedOut();

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectUnauthorized(response);
      expect(prisma.cateringRequest.findFirst).not.toHaveBeenCalled();
      expect(prisma.fileUpload.findMany).not.toHaveBeenCalled();
    });

    it('should authorize a Bearer token with no cookie session (native wrapper apps)', async () => {
      // The wrapper apps have no Supabase cookie jar: the only credential on
      // the request is the Authorization header. The route must honour it the
      // same way every other `withAuth()` route does.
      signInViaBearerOnly('driver-123', UserType.DRIVER, 'wrapper-access-token');

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue({ id: 'dispatch-1' });

      const podFile = {
        id: 'file-pod',
        fileName: 'pod.jpg',
        fileUrl: 'https://storage.example.com/pod.jpg',
        fileType: 'image/jpeg',
        fileSize: 4096,
        category: 'proof_of_delivery',
        uploadedAt: new Date('2024-01-20T14:00:00Z'),
        cateringRequestId: 'order-1',
      };
      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([podFile]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files', {
        Authorization: 'Bearer wrapper-access-token',
      });
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(mockGetUser).toHaveBeenCalledWith('wrapper-access-token');
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ id: 'file-pod', category: 'proof_of_delivery' });
    });

    it('should return 401 for a Bearer token that does not resolve to a user', async () => {
      signInViaBearerOnly('driver-123', UserType.DRIVER, 'valid-token');

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files', {
        Authorization: 'Bearer expired-token',
      });
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectUnauthorized(response);
      expect(prisma.cateringRequest.findFirst).not.toHaveBeenCalled();
    });

    it('should reject an authenticated user whose profile has no role', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
      mockGetUserRole.mockResolvedValue(null);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response, /role not found/i);
      expect(prisma.cateringRequest.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('🔒 Authorization Tests', () => {
    beforeEach(() => {
      // No dispatch assignment by default — the user is not the assigned driver,
      // so access must fall through to 403 rather than the driver-access path.
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should return 403 when CLIENT tries to access another user order files', async () => {
      signInViaCookie('user-123', UserType.CLIENT);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999', // Different user
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response, /do not have permission/i);
    });

    it('should return 403 when VENDOR tries to access order files', async () => {
      signInViaCookie('user-123', UserType.VENDOR);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to access order files', async () => {
      signInViaCookie('user-123', UserType.DRIVER);

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response);
    });

    it('should return 403 when a DRIVER with a Bearer token is not dispatched to the order', async () => {
      // Bearer auth must not widen access: the dispatch check still applies.
      signInViaBearerOnly('driver-123', UserType.DRIVER, 'wrapper-access-token');

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files', {
        Authorization: 'Bearer wrapper-access-token',
      });
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response, /do not have permission/i);
      expect(prisma.fileUpload.findMany).not.toHaveBeenCalled();
    });
  });

  describe('✏️ Validation Tests', () => {
    beforeEach(() => {
      signInViaCookie('admin-123', UserType.ADMIN);
    });

    it('should return 404 when order is not found', async () => {
      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest('http://localhost:3000/api/orders/NONEXISTENT/files');
      const params = { order_number: 'NONEXISTENT' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectErrorResponse(response, 404, /Order not found/i);
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      signInViaCookie('admin-123', UserType.ADMIN);
    });

    it('should handle database errors when fetching order', async () => {
      (prisma.cateringRequest.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectErrorResponse(response, 500, /Internal server error/i);
    });

    it('should handle database errors when fetching files', async () => {
      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      signInViaCookie('user-123', UserType.CLIENT);
    });

    it('should return files ordered by uploadedAt descending', async () => {
      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      const mockFiles = [
        {
          id: 'file-1',
          fileName: 'latest.pdf',
          uploadedAt: new Date('2024-01-20T10:00:00Z'),
          cateringRequestId: 'order-1',
        },
        {
          id: 'file-2',
          fileName: 'older.pdf',
          uploadedAt: new Date('2024-01-10T10:00:00Z'),
          cateringRequestId: 'order-1',
        },
      ];

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue(mockFiles);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });
      const data = await expectSuccessResponse(response, 200);

      expect(data[0].fileName).toBe('latest.pdf');
      expect(data[1].fileName).toBe('older.pdf');
    });

    it('should handle both catering and on-demand file categories', async () => {
      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-123',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectSuccessResponse(response, 200);

      expect(prisma.fileUpload.findMany).toHaveBeenCalledWith({
        where: {
          OR: expect.arrayContaining([
            { cateringRequestId: 'order-1' },
            { onDemandId: 'order-1' },
            expect.any(Object),
          ]),
        },
        orderBy: {
          uploadedAt: 'desc',
        },
        take: 100,
      });
    });
  });
});
