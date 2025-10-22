// src/__tests__/api/dispatch/dispatch-order.test.ts

import { GET } from '@/app/api/dispatch/[orderId]/route';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    dispatch: {
      findFirst: jest.fn(),
    },
  },
}));

describe('GET /api/dispatch/[orderId] - Get Dispatch by Order ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Retrieval', () => {
    it('should return dispatch for catering order', async () => {
      const mockDispatch = {
        id: 'dispatch-1',
        cateringRequestId: 'cater-order-1',
        onDemandId: null,
        driverId: 'driver-123',
        driver: {
          id: 'driver-123',
          name: 'John Driver',
          email: 'driver@example.com',
          contactNumber: '555-1234',
        },
        cateringRequest: {
          id: 'cater-order-1',
          orderNumber: 'CATER-001',
          pickupDateTime: new Date('2025-10-25T10:00:00Z'),
          status: 'CONFIRMED',
        },
        onDemand: null,
        createdAt: new Date('2025-10-22T10:00:00Z'),
        updatedAt: new Date('2025-10-22T10:00:00Z'),
      };

      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockDispatch);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/cater-order-1'
      );

      const context = {
        params: Promise.resolve({ orderId: 'cater-order-1' }),
      };

      const response = await GET(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.id).toBe('dispatch-1');
      expect(data.orderType).toBe('catering');
      expect(data.orderId).toBe('cater-order-1');
      expect(data.driverId).toBe('driver-123');
      expect(data.driver.name).toBe('John Driver');
      expect(data.order.orderNumber).toBe('CATER-001');
    });

    it('should return dispatch for on-demand order', async () => {
      const mockDispatch = {
        id: 'dispatch-2',
        cateringRequestId: null,
        onDemandId: 'od-order-1',
        driverId: 'driver-456',
        driver: {
          id: 'driver-456',
          name: 'Jane Driver',
          email: 'jane@example.com',
          contactNumber: '555-5678',
        },
        cateringRequest: null,
        onDemand: {
          id: 'od-order-1',
          orderNumber: 'OD-001',
          pickupDateTime: new Date('2025-10-25T14:00:00Z'),
          status: 'ACTIVE',
        },
        createdAt: new Date('2025-10-22T11:00:00Z'),
        updatedAt: new Date('2025-10-22T11:00:00Z'),
      };

      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockDispatch);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/od-order-1'
      );

      const context = {
        params: Promise.resolve({ orderId: 'od-order-1' }),
      };

      const response = await GET(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orderType).toBe('onDemand');
      expect(data.orderId).toBe('od-order-1');
      expect(data.order.orderNumber).toBe('OD-001');
    });

    it('should handle dispatch without driver assigned', async () => {
      const mockDispatch = {
        id: 'dispatch-3',
        cateringRequestId: 'cater-order-2',
        onDemandId: null,
        driverId: null,
        driver: null,
        cateringRequest: {
          id: 'cater-order-2',
          orderNumber: 'CATER-002',
          pickupDateTime: new Date(),
          status: 'PENDING',
        },
        onDemand: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockDispatch);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/cater-order-2'
      );

      const context = {
        params: Promise.resolve({ orderId: 'cater-order-2' }),
      };

      const response = await GET(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.driver).toBeNull();
      expect(data.driverId).toBeNull();
    });

    it('should search by both catering and on-demand IDs', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue({
        id: 'dispatch-1',
        cateringRequestId: 'order-1',
        driver: null,
        cateringRequest: {
          id: 'order-1',
          orderNumber: 'TEST-001',
          pickupDateTime: new Date(),
          status: 'ACTIVE',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/order-1'
      );

      const context = {
        params: Promise.resolve({ orderId: 'order-1' }),
      };

      await GET(request, context);

      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { cateringRequestId: 'order-1' },
              { onDemandId: 'order-1' },
            ],
          },
        })
      );
    });
  });

  describe('❌ Error Handling', () => {
    it('should return 404 when dispatch is not found', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(null);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/nonexistent'
      );

      const context = {
        params: Promise.resolve({ orderId: 'nonexistent' }),
      };

      const response = await GET(request, context);
      await expectErrorResponse(response, 404, /Dispatch not found/i);
    });

    it('should handle database query errors', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/order-1'
      );

      const context = {
        params: Promise.resolve({ orderId: 'order-1' }),
      };

      const response = await GET(request, context);
      await expectErrorResponse(response, 500, /Failed to fetch dispatch information/i);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should handle dispatch with missing order data', async () => {
      const mockDispatch = {
        id: 'dispatch-4',
        cateringRequestId: 'missing-order',
        onDemandId: null,
        driverId: 'driver-123',
        driver: {
          id: 'driver-123',
          name: 'John Driver',
          email: 'driver@example.com',
          contactNumber: '555-1234',
        },
        cateringRequest: null, // Order data missing
        onDemand: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockDispatch);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/missing-order'
      );

      const context = {
        params: Promise.resolve({ orderId: 'missing-order' }),
      };

      const response = await GET(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(data.order).toBeNull();
    });

    it('should convert BigInt IDs to strings', async () => {
      const mockDispatch = {
        id: 'dispatch-5',
        cateringRequestId: 'order-5',
        onDemandId: null,
        driverId: 'driver-123',
        driver: null,
        cateringRequest: {
          id: BigInt(12345),
          orderNumber: 'CATER-005',
          pickupDateTime: new Date(),
          status: 'CONFIRMED',
        },
        onDemand: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockDispatch);

      const request = createGetRequest(
        'http://localhost:3000/api/dispatch/order-5'
      );

      const context = {
        params: Promise.resolve({ orderId: 'order-5' }),
      };

      const response = await GET(request, context);
      const data = await expectSuccessResponse(response, 200);

      expect(typeof data.order.id).toBe('string');
      expect(data.order.id).toBe('12345');
    });
  });
});
