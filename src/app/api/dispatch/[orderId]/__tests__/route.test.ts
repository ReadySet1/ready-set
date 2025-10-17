/**
 * Tests for /api/dispatch/[orderId] route
 *
 * Critical functionality tested:
 * - Dispatch retrieval by order ID
 * - Support for both catering and on-demand orders
 * - Driver information exposure
 * - Error handling and validation
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/utils/prismaDB';

// Mock Prisma
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    dispatch: {
      findFirst: jest.fn(),
    },
  },
}));

describe('GET /api/dispatch/[orderId]', () => {
  const mockCateringDispatch = {
    id: 'dispatch-1',
    cateringRequestId: 'catering-123',
    onDemandId: null,
    driverId: 'driver-1',
    driver: {
      id: 'driver-1',
      name: 'John Driver',
      email: 'john@example.com',
      contactNumber: '555-0123',
    },
    cateringRequest: {
      id: BigInt(123),
      orderNumber: 'CAT-001',
      pickupDateTime: new Date('2025-01-15T10:00:00Z'),
      status: 'PENDING',
    },
    onDemand: null,
    createdAt: new Date('2025-01-15T08:00:00Z'),
    updatedAt: new Date('2025-01-15T08:30:00Z'),
  };

  const mockOnDemandDispatch = {
    id: 'dispatch-2',
    cateringRequestId: null,
    onDemandId: 'ondemand-456',
    driverId: 'driver-2',
    driver: {
      id: 'driver-2',
      name: 'Jane Driver',
      email: 'jane@example.com',
      contactNumber: '555-0456',
    },
    cateringRequest: null,
    onDemand: {
      id: BigInt(456),
      orderNumber: 'OD-002',
      pickupDateTime: new Date('2025-01-15T14:00:00Z'),
      status: 'IN_PROGRESS',
    },
    createdAt: new Date('2025-01-15T12:00:00Z'),
    updatedAt: new Date('2025-01-15T13:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful dispatch retrieval', () => {
    it('should retrieve dispatch for catering order', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: 'dispatch-1',
        orderType: 'catering',
        orderId: 'catering-123',
        driverId: 'driver-1',
        driver: {
          id: 'driver-1',
          name: 'John Driver',
          email: 'john@example.com',
          contactNumber: '555-0123',
        },
        order: {
          id: '123',
          orderNumber: 'CAT-001',
          pickupDateTime: mockCateringDispatch.cateringRequest?.pickupDateTime,
          status: 'PENDING',
        },
        createdAt: mockCateringDispatch.createdAt,
        updatedAt: mockCateringDispatch.updatedAt,
      });

      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { cateringRequestId: 'catering-123' },
            { onDemandId: 'catering-123' },
          ],
        },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
            },
          },
          cateringRequest: true,
          onDemand: true,
        },
      });
    });

    it('should retrieve dispatch for on-demand order', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockOnDemandDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/ondemand-456');
      const params = Promise.resolve({ orderId: 'ondemand-456' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderType).toBe('onDemand');
      expect(data.orderId).toBe('ondemand-456');
      expect(data.driver).toEqual({
        id: 'driver-2',
        name: 'Jane Driver',
        email: 'jane@example.com',
        contactNumber: '555-0456',
      });
      expect(data.order).toEqual({
        id: '456',
        orderNumber: 'OD-002',
        pickupDateTime: mockOnDemandDispatch.onDemand?.pickupDateTime,
        status: 'IN_PROGRESS',
      });
    });

    it('should handle dispatch without driver', async () => {
      const dispatchWithoutDriver = {
        ...mockCateringDispatch,
        driver: null,
        driverId: null,
      };
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(dispatchWithoutDriver);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.driver).toBeNull();
      expect(data.driverId).toBeNull();
    });

    it('should handle dispatch without order details', async () => {
      const dispatchWithoutOrder = {
        ...mockCateringDispatch,
        cateringRequest: null,
      };
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(dispatchWithoutOrder);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.order).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should return 404 when dispatch not found', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/dispatch/nonexistent');
      const params = Promise.resolve({ orderId: 'nonexistent' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: 'Dispatch not found' });
    });

    it('should return 500 on database error', async () => {
      const dbError = new Error('Database connection failed');
      (prisma.dispatch.findFirst as jest.Mock).mockRejectedValue(dbError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/dispatch/test-id');
      const params = Promise.resolve({ orderId: 'test-id' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: 'Failed to fetch dispatch information' });
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching dispatch:', dbError);

      consoleSpy.mockRestore();
    });

    it('should handle unexpected errors gracefully', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const request = new NextRequest('http://localhost:3000/api/dispatch/error-test');
      const params = Promise.resolve({ orderId: 'error-test' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch dispatch information');

      consoleSpy.mockRestore();
    });
  });

  describe('Data integrity', () => {
    it('should correctly convert BigInt IDs to strings', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.order.id).toBe('123');
      expect(typeof data.order.id).toBe('string');
    });

    it('should correctly identify order type from dispatch data', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.orderType).toBe('catering');

      // Now test on-demand
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockOnDemandDispatch);

      const request2 = new NextRequest('http://localhost:3000/api/dispatch/ondemand-456');
      const params2 = Promise.resolve({ orderId: 'ondemand-456' });
      const response2 = await GET(request2, { params: params2 });
      const data2 = await response2.json();

      expect(data2.orderType).toBe('onDemand');
    });

    it('should preserve timestamp formats', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.createdAt).toEqual(mockCateringDispatch.createdAt);
      expect(data.updatedAt).toEqual(mockCateringDispatch.updatedAt);
      expect(data.order.pickupDateTime).toEqual(mockCateringDispatch.cateringRequest?.pickupDateTime);
    });
  });

  describe('Query flexibility', () => {
    it('should find dispatch by catering request ID', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      await GET(request, { params });

      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { cateringRequestId: 'catering-123' },
              { onDemandId: 'catering-123' },
            ],
          },
        })
      );
    });

    it('should find dispatch by on-demand ID', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockOnDemandDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/ondemand-456');
      const params = Promise.resolve({ orderId: 'ondemand-456' });
      await GET(request, { params });

      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { cateringRequestId: 'ondemand-456' },
              { onDemandId: 'ondemand-456' },
            ],
          },
        })
      );
    });
  });

  describe('Driver information security', () => {
    it('should only expose safe driver fields', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Verify only safe fields are exposed
      expect(Object.keys(data.driver)).toEqual(['id', 'name', 'email', 'contactNumber']);

      // Verify the query only selects safe fields
      expect(prisma.dispatch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            driver: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
          }),
        })
      );
    });
  });

  describe('Response structure validation', () => {
    it('should return consistent response structure for catering orders', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('orderType');
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('driverId');
      expect(data).toHaveProperty('driver');
      expect(data).toHaveProperty('order');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });

    it('should return consistent response structure for on-demand orders', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockOnDemandDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/ondemand-456');
      const params = Promise.resolve({ orderId: 'ondemand-456' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('orderType');
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('driverId');
      expect(data).toHaveProperty('driver');
      expect(data).toHaveProperty('order');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });

    it('should include order details with correct structure', async () => {
      (prisma.dispatch.findFirst as jest.Mock).mockResolvedValue(mockCateringDispatch);

      const request = new NextRequest('http://localhost:3000/api/dispatch/catering-123');
      const params = Promise.resolve({ orderId: 'catering-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      expect(data.order).toHaveProperty('id');
      expect(data.order).toHaveProperty('orderNumber');
      expect(data.order).toHaveProperty('pickupDateTime');
      expect(data.order).toHaveProperty('status');
      expect(Object.keys(data.order)).toHaveLength(4);
    });
  });
});
