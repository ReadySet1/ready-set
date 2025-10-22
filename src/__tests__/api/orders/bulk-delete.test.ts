// src/__tests__/api/orders/bulk-delete.test.ts

import { POST } from '@/app/api/orders/bulk-delete/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { storage } from '@/utils/supabase/storage';
import { UserType } from '@/types/prisma';
import {
  createPostRequest,
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
      findUnique: jest.fn(),
    },
    onDemand: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/supabase/storage', () => ({
  storage: {
    from: jest.fn(),
  },
}));

describe('POST /api/orders/bulk-delete - Bulk Delete Orders', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  const mockStorageBucket = {
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (storage.from as jest.Mock).mockResolvedValue(mockStorageBucket);
  });

  describe('✅ Successful Bulk Deletion', () => {
    it('should delete multiple catering orders', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.cateringRequest.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'order-1' })
        .mockResolvedValueOnce({ id: 'order-2' });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001', 'CATER-002'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.message).toMatch(/Bulk deletion attempted/i);
      expect(data.results.deleted).toHaveLength(2);
      expect(data.results.deleted).toContain('CATER-001');
      expect(data.results.deleted).toContain('CATER-002');
      expect(data.results.failed).toHaveLength(0);
    });

    it('should delete mixed catering and on-demand orders', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN,
      });

      // First order is catering
      (prisma.cateringRequest.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'order-1' })
        .mockResolvedValueOnce(null);

      // Second order is on-demand
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue({ id: 'order-2' });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
          onDemand: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001', 'OD-002'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.deleted).toHaveLength(2);
    });

    it('should handle partial failures gracefully', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      // First order exists
      (prisma.cateringRequest.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'order-1' })
        .mockResolvedValueOnce(null);

      // Second order doesn't exist
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001', 'NONEXISTENT'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.deleted).toHaveLength(1);
      expect(data.results.deleted).toContain('CATER-001');
      expect(data.results.failed).toHaveLength(1);
      expect(data.results.failed[0].orderNumber).toBe('NONEXISTENT');
      expect(data.results.failed[0].reason).toMatch(/not found/i);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      await expectUnauthorized(response);
    });
  });

  describe('🔒 Authorization Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should return 403 when CLIENT tries to bulk delete', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      await expectForbidden(response, /Admin permissions required/i);
    });

    it('should return 403 when VENDOR tries to bulk delete', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.VENDOR,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to bulk delete', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.DRIVER,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      await expectForbidden(response);
    });

    it('should return 403 when HELPDESK tries to bulk delete', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.HELPDESK,
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      await expectForbidden(response);
    });
  });

  describe('✏️ Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it('should return 400 when orderNumbers is not an array', async () => {
      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: 'CATER-001',
        }
      );

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Expected an array/i);
    });

    it('should return 400 when orderNumbers is empty array', async () => {
      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: [],
        }
      );

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Expected an array/i);
    });

    it('should return 400 when orderNumbers is missing', async () => {
      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {}
      );

      const response = await POST(request);
      await expectErrorResponse(response, 400);
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it('should handle transaction failures', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.failed).toHaveLength(1);
      expect(data.results.failed[0].reason).toMatch(/Transaction failed/i);
    });

    it('should continue processing after individual order failure', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ id: 'order-2' });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001', 'CATER-002'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.failed).toHaveLength(1);
      expect(data.results.deleted).toHaveLength(1);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });
    });

    it('should handle single order deletion', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['CATER-001'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.deleted).toHaveLength(1);
    });

    it('should handle large batch of orders', async () => {
      const orderNumbers = Array.from({ length: 10 }, (_, i) => `CATER-${String(i + 1).padStart(3, '0')}`);

      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-id',
      });

      (prisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          cateringRequest: { delete: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        { orderNumbers }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.deleted).toHaveLength(10);
    });

    it('should report all orders not found', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createPostRequest(
        'http://localhost:3000/api/orders/bulk-delete',
        {
          orderNumbers: ['NON-1', 'NON-2', 'NON-3'],
        }
      );

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.results.deleted).toHaveLength(0);
      expect(data.results.failed).toHaveLength(3);
    });
  });
});
