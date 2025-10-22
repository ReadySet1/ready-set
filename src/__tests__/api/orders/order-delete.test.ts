// src/__tests__/api/orders/order-delete.test.ts

import { DELETE } from '@/app/api/orders/delete/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { UserType } from '@/types/prisma';
import {
  createDeleteRequest,
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
      delete: jest.fn(),
    },
    onDemand: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('DELETE /api/orders/delete - Delete Order', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
    storage: {
      from: jest.fn().mockReturnThis(),
      list: jest.fn(),
      remove: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('✅ Successful Deletion', () => {
    it('should delete catering order with associated data', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-123' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.SUPER_ADMIN,
      });

      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
        orderNumber: 'CATER-001',
      });

      // Mock the transaction
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
          fileUpload: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          cateringRequest: {
            delete: jest.fn().mockResolvedValue({ id: 'order-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
      expect(data.message).toMatch(/deleted successfully/i);
      expect(data.details).toHaveProperty('deletedDispatches');
      expect(data.details).toHaveProperty('deletedFiles');
      expect(data.details).toHaveProperty('deletedOrder');
    });

    it('should delete on-demand order by ADMIN', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-456' } },
      });

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.ADMIN,
      });

      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-2',
        orderNumber: 'OD-002',
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          fileUpload: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          onDemand: {
            delete: jest.fn().mockResolvedValue({ id: 'order-2' }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-2&orderType=onDemand'
      );

      const response = await DELETE(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.success).toBe(true);
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectUnauthorized(response);
    });
  });

  describe('🔒 Authorization Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should return 403 when CLIENT tries to delete order', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.CLIENT,
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectForbidden(response, /Only administrators can delete orders/i);
    });

    it('should return 403 when VENDOR tries to delete order', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.VENDOR,
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectForbidden(response);
    });

    it('should return 403 when DRIVER tries to delete order', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.DRIVER,
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectForbidden(response);
    });

    it('should return 403 when HELPDESK tries to delete order', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        type: UserType.HELPDESK,
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
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

    it('should return 400 when orderId is missing', async () => {
      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderType=catering'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 400, /Missing required parameters/i);
    });

    it('should return 400 when orderType is missing', async () => {
      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 400, /Missing required parameters/i);
    });

    it('should return 400 when both parameters are missing', async () => {
      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 400, /Missing required parameters/i);
    });

    it('should return 400 when orderType is invalid', async () => {
      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=invalid'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 400, /Invalid orderType/i);
    });

    it('should accept valid orderType: catering', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          cateringRequest: {
            delete: jest.fn().mockResolvedValue({ id: 'order-1' }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectSuccessResponse(response, 200);
    });

    it('should accept valid orderType: onDemand', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-2',
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockTx = {
          dispatch: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          fileUpload: {
            findMany: jest.fn().mockResolvedValue([]),
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          onDemand: {
            delete: jest.fn().mockResolvedValue({ id: 'order-2' }),
          },
        };
        return callback(mockTx);
      });

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-2&orderType=onDemand'
      );

      const response = await DELETE(request);
      await expectSuccessResponse(response, 200);
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

    it('should return 404 when order is not found', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.onDemand.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=nonexistent&orderType=catering'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 404, /Order.*not found/i);
    });

    it('should handle database transaction errors', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'order-1',
      });

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      const request = createDeleteRequest(
        'http://localhost:3000/api/orders/delete?orderId=order-1&orderType=catering'
      );

      const response = await DELETE(request);
      await expectErrorResponse(response, 500, /error occurred/i);
    });
  });
});
