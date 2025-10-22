// src/__tests__/api/orders/order-files.test.ts

import { GET } from '@/app/api/orders/[order_number]/files/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
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
    profile: {
      findUnique: jest.fn(),
    },
    cateringRequest: {
      findFirst: jest.fn(),
    },
    onDemand: {
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

describe('GET /api/orders/[order_number]/files - Fetch Order Files', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Fetch', () => {
    it('should fetch files for catering order by order owner', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

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
      });
    });

    it('should fetch files for on-demand order by ADMIN', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-456' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN,
      });

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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'superadmin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'helpdesk-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.HELPDESK,
      });

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

    it('should return empty array when order has no files', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

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
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectUnauthorized(response);
      expect(prisma.cateringRequest.findFirst).not.toHaveBeenCalled();
    });

    it('should return 401 when user profile not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectUnauthorized(response);
    });
  });

  describe('🔒 Authorization Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should return 403 when CLIENT tries to access another user order files', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

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
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.VENDOR,
      });

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
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.DRIVER,
      });

      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        userId: 'user-999',
      });

      const request = createGetRequest('http://localhost:3000/api/orders/CATER-001/files');
      const params = { order_number: 'CATER-001' };
      const response = await GET(request, { params: Promise.resolve(params) });

      await expectForbidden(response);
    });
  });

  describe('✏️ Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN,
      });
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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN,
      });
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
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });
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
      });
    });
  });
});
