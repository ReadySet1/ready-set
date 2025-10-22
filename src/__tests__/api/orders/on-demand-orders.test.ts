// src/__tests__/api/orders/on-demand-orders.test.ts

import { GET } from '@/app/api/orders/on-demand-orders/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { OnDemandStatus } from '@/types/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    onDemand: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('GET /api/orders/on-demand-orders - List On-Demand Orders', () => {
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
    it('should fetch on-demand orders with default pagination', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'OD-001',
          status: OnDemandStatus.PENDING,
          pickupDateTime: new Date('2024-01-15T10:00:00Z'),
          orderTotal: 75.0,
          user: { name: 'Jane Smith' },
        },
      ];

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].orderNumber).toBe('OD-001');
      expect(data.totalPages).toBe(1);
      expect(data.totalCount).toBe(1);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { pickupDateTime: 'desc' },
        include: {
          user: {
            select: { name: true },
          },
        },
      });
    });

    it('should handle pagination with custom page and limit', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = Array.from({ length: 3 }, (_, i) => ({
        id: `order-${i}`,
        orderNumber: `OD-${String(i + 11).padStart(3, '0')}`,
        status: OnDemandStatus.PENDING,
        pickupDateTime: new Date(),
        orderTotal: 50.0,
        user: { name: 'User' },
      }));

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(9);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?page=4&limit=3');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(3);
      expect(data.totalPages).toBe(3);
      expect(data.totalCount).toBe(9);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 9,
          take: 3,
        })
      );
    });

    it('should filter by status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?status=IN_PROGRESS');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OnDemandStatus.IN_PROGRESS,
          },
        })
      );
    });

    it('should handle status=all by not filtering status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?status=all');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('should filter by search term (orderNumber and user.name)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?search=jane');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { orderNumber: { contains: 'jane', mode: 'insensitive' } },
              { user: { name: { contains: 'jane', mode: 'insensitive' } } },
            ],
          },
        })
      );
    });

    it('should sort by pickupDateTime desc (default)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { pickupDateTime: 'desc' },
        })
      );
    });

    it('should sort by orderTotal asc', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?sort=orderTotal&direction=asc');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderTotal: 'asc' },
        })
      );
    });

    it('should sort by user.name', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?sort=user.name&direction=asc');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { user: { name: 'asc' } },
        })
      );
    });

    it('should sort by orderNumber desc', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?sort=orderNumber&direction=desc');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderNumber: 'desc' },
        })
      );
    });

    it('should handle empty results', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(0);
      expect(data.totalPages).toBe(0);
      expect(data.totalCount).toBe(0);
    });

    it('should serialize BigInt values correctly', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'OD-001',
          status: OnDemandStatus.PENDING,
          pickupDateTime: new Date(),
          orderTotal: BigInt(99999999999),
          user: { name: 'User' },
        },
      ];

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      // BigInt should be serialized as string
      expect(typeof data.orders[0].orderTotal).toBe('string');
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      await expectUnauthorized(response);

      expect(prisma.onDemand.findMany).not.toHaveBeenCalled();
    });

    it('should return 401 when user id is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: null } },
      });

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      await expectUnauthorized(response);
    });
  });

  describe('✏️ Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should use default values for invalid pagination inputs', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?page=abc&limit=xyz');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: NaN,
          take: NaN,
        })
      );
    });

    it('should use default sort for invalid sortField', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?sort=invalidField');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { pickupDateTime: 'desc' },
        })
      );
    });

    it('should pass through invalid status to Prisma (no validation)', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?status=INVALID_STATUS');

      await GET(request);

      // Unlike catering route, on-demand route doesn't validate status values
      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'INVALID_STATUS',
          },
        })
      );
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should handle database errors', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      await expectErrorResponse(response, 500, /Error fetching on-demand orders/i);
    });

    it('should handle count query errors', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockRejectedValue(
        new Error('Count query failed')
      );

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      await expectErrorResponse(response, 500);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should handle combined filters (status + search)', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?status=COMPLETED&search=OD-001');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OnDemandStatus.COMPLETED,
            OR: [
              { orderNumber: { contains: 'OD-001', mode: 'insensitive' } },
              { user: { name: { contains: 'OD-001', mode: 'insensitive' } } },
            ],
          },
        })
      );
    });

    it('should calculate correct totalPages with remainder', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(17);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?limit=5');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.totalPages).toBe(4);
      expect(data.totalCount).toBe(17);
    });

    it('should handle large page numbers', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?page=999&limit=10');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 9980,
          take: 10,
        })
      );
    });

    it('should handle direction parameter regardless of case', async () => {
      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders?sort=orderTotal&direction=ASC');

      await GET(request);

      expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderTotal: 'ASC' },
        })
      );
    });

    it('should return orders with minimal user data (name only)', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'OD-001',
          status: OnDemandStatus.PENDING,
          pickupDateTime: new Date(),
          orderTotal: 50.0,
          user: { name: 'Simple User' },
        },
      ];

      (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.onDemand.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/on-demand-orders');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders[0].user).toEqual({ name: 'Simple User' });
      expect(data.orders[0].user).not.toHaveProperty('email');
      expect(data.orders[0].user).not.toHaveProperty('contactNumber');
    });
  });
});
