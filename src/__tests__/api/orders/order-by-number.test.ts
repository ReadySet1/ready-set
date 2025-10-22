// src/__tests__/api/orders/order-by-number.test.ts

import { GET, PATCH } from '@/app/api/orders/[order_number]/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import {
  createGetRequest,
  createPatchRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    onDemand: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('/api/orders/[order_number] - Get and Update Order', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/orders/[order_number] - Fetch Order', () => {
    describe('✅ Successful Fetch', () => {
      it('should fetch catering order by order number', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        const mockOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: 'PENDING',
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: { street: '123 Main St' },
          deliveryAddress: { street: '456 Oak Ave', state: 'CA' },
          dispatches: [],
          fileUploads: [],
          pickupDateTime: new Date('2024-01-15T10:00:00Z'),
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-10T00:00:00Z'),
        };

        (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(mockOrder);

        const request = createGetRequest('http://localhost:3000/api/orders/CATER-001');
        const params = { order_number: 'CATER-001' };
        const response = await GET(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.orderNumber).toBe('CATER-001');
        expect(data.order_type).toBe('catering');
        expect(prisma.cateringRequest.findFirst).toHaveBeenCalledWith({
          where: {
            orderNumber: { equals: 'CATER-001', mode: 'insensitive' },
            deletedAt: null,
          },
          include: expect.any(Object),
        });
      });

      it('should fetch on-demand order when catering not found', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);

        const mockOrder = {
          id: 'order-2',
          orderNumber: 'OD-002',
          status: 'IN_PROGRESS',
          user: { name: 'Jane Smith', email: 'jane@example.com' },
          pickupAddress: { street: '789 Pine St' },
          deliveryAddress: { street: '321 Elm St', state: 'TX' },
          dispatches: [],
          fileUploads: [],
          pickupDateTime: new Date('2024-01-15T14:00:00Z'),
          createdAt: new Date('2024-01-05T00:00:00Z'),
          updatedAt: new Date('2024-01-12T00:00:00Z'),
        };

        (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue(mockOrder);

        const request = createGetRequest('http://localhost:3000/api/orders/OD-002');
        const params = { order_number: 'OD-002' };
        const response = await GET(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.orderNumber).toBe('OD-002');
        expect(data.order_type).toBe('on_demand');
      });

      it('should handle case-insensitive order number search', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        const mockOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: 'PENDING',
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: {},
          deliveryAddress: { state: 'CA' },
          dispatches: [],
          fileUploads: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(mockOrder);

        const request = createGetRequest('http://localhost:3000/api/orders/cater-001');
        const params = { order_number: 'cater-001' };
        const response = await GET(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.orderNumber).toBe('CATER-001');
      });

      it('should handle URL encoded order numbers', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        const mockOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: 'PENDING',
          user: { name: 'Test', email: 'test@example.com' },
          pickupAddress: {},
          deliveryAddress: { state: 'CA' },
          dispatches: [],
          fileUploads: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(mockOrder);

        const request = createGetRequest('http://localhost:3000/api/orders/CATER%2D001');
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

        const request = createGetRequest('http://localhost:3000/api/orders/CATER-001');
        const params = { order_number: 'CATER-001' };
        const response = await GET(request, { params: Promise.resolve(params) });

        await expectUnauthorized(response);
        expect(prisma.cateringRequest.findFirst).not.toHaveBeenCalled();
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 404 when order is not found', async () => {
        (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);

        const request = createGetRequest('http://localhost:3000/api/orders/NONEXISTENT');
        const params = { order_number: 'NONEXISTENT' };
        const response = await GET(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 404, /Order not found/i);
      });

      it('should handle database errors', async () => {
        (prisma.cateringRequest.findFirst as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest('http://localhost:3000/api/orders/CATER-001');
        const params = { order_number: 'CATER-001' };
        const response = await GET(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 500, /Error fetching order/i);
      });

      it('should exclude soft-deleted orders', async () => {
        const mockDeletedOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          deletedAt: new Date(),
        };

        (prisma.cateringRequest.findFirst as jest.Mock).mockImplementation(({ where }) => {
          if (where.deletedAt === null) {
            return Promise.resolve(null);
          }
          return Promise.resolve(mockDeletedOrder);
        });

        (prisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);

        const request = createGetRequest('http://localhost:3000/api/orders/CATER-001');
        const params = { order_number: 'CATER-001' };
        const response = await GET(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 404, /Order not found/i);
      });
    });
  });

  describe('PATCH /api/orders/[order_number] - Update Order', () => {
    describe('✅ Successful Update', () => {
      it('should update catering order status', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        const mockExistingOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
        };

        const mockUpdatedOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: 'IN_PROGRESS',
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: {},
          deliveryAddress: { state: 'CA' },
          dispatches: [],
          fileUploads: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockExistingOrder);
        (prisma.cateringRequest.update as jest.Mock).mockResolvedValue(mockUpdatedOrder);

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/CATER-001',
          { status: 'IN_PROGRESS' }
        );
        const params = { order_number: 'CATER-001' };
        const response = await PATCH(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.status).toBe('IN_PROGRESS');
        expect(data.order_type).toBe('catering');
        expect(prisma.cateringRequest.update).toHaveBeenCalledWith({
          where: { orderNumber: 'CATER-001' },
          data: { status: 'IN_PROGRESS' },
          include: expect.any(Object),
        });
      });

      it('should update on-demand order driver status', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        const mockUpdatedOrder = {
          id: 'order-2',
          orderNumber: 'OD-002',
          driverStatus: 'EN_ROUTE',
          user: { name: 'Jane Smith', email: 'jane@example.com' },
          pickupAddress: {},
          deliveryAddress: { state: 'TX' },
          dispatches: [],
          fileUploads: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (prisma.onDemand.update as jest.Mock).mockResolvedValue(mockUpdatedOrder);

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/OD-002',
          { driverStatus: 'EN_ROUTE' }
        );
        const params = { order_number: 'OD-002' };
        const response = await PATCH(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.driverStatus).toBe('EN_ROUTE');
        expect(data.order_type).toBe('on_demand');
      });

      it('should update both status and driverStatus', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });

        const mockExistingOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
        };

        const mockUpdatedOrder = {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: 'IN_PROGRESS',
          driverStatus: 'ASSIGNED',
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: {},
          deliveryAddress: { state: 'CA' },
          dispatches: [],
          fileUploads: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockExistingOrder);
        (prisma.cateringRequest.update as jest.Mock).mockResolvedValue(mockUpdatedOrder);

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/CATER-001',
          { status: 'IN_PROGRESS', driverStatus: 'ASSIGNED' }
        );
        const params = { order_number: 'CATER-001' };
        const response = await PATCH(request, { params: Promise.resolve(params) });
        const data = await expectSuccessResponse(response, 200);

        expect(data.status).toBe('IN_PROGRESS');
        expect(data.driverStatus).toBe('ASSIGNED');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
        });

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/CATER-001',
          { status: 'IN_PROGRESS' }
        );
        const params = { order_number: 'CATER-001' };
        const response = await PATCH(request, { params: Promise.resolve(params) });

        await expectUnauthorized(response);
        expect(prisma.cateringRequest.findUnique).not.toHaveBeenCalled();
      });
    });

    describe('✏️ Validation Tests', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 400 when no update data provided', async () => {
        const request = createPatchRequest(
          'http://localhost:3000/api/orders/CATER-001',
          {}
        );
        const params = { order_number: 'CATER-001' };
        const response = await PATCH(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 400, /No update data provided/i);
      });
    });

    describe('❌ Error Handling', () => {
      beforeEach(() => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
        });
      });

      it('should return 404 when order is not found for update', async () => {
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.onDemand.update as jest.Mock).mockRejectedValue(
          new Error('Record to update not found')
        );

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/NONEXISTENT',
          { status: 'IN_PROGRESS' }
        );
        const params = { order_number: 'NONEXISTENT' };
        const response = await PATCH(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 500);
      });

      it('should handle database errors during update', async () => {
        const mockExistingOrder = { id: 'order-1', orderNumber: 'CATER-001' };
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(mockExistingOrder);
        (prisma.cateringRequest.update as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPatchRequest(
          'http://localhost:3000/api/orders/CATER-001',
          { status: 'IN_PROGRESS' }
        );
        const params = { order_number: 'CATER-001' };
        const response = await PATCH(request, { params: Promise.resolve(params) });

        await expectErrorResponse(response, 500, /Error updating order/i);
      });
    });
  });
});
