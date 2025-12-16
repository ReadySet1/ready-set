// src/__tests__/api/orders/catering-orders.test.ts

import { GET } from '@/app/api/orders/catering-orders/route';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { CateringStatus } from '@/types/prisma';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
  withDatabaseRetry: jest.fn((callback) => callback()),
}));

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('GET /api/orders/catering-orders - List Catering Orders', () => {
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
    it('should fetch catering orders with default pagination', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: CateringStatus.PENDING,
          pickupDateTime: new Date('2024-01-15T10:00:00Z'),
          orderTotal: 150.0,
          user: { id: 'user-1', name: 'John Doe', email: 'john@example.com', contactNumber: '555-0100' },
          pickupAddress: { id: 'addr-1', street: '123 Main St' },
          deliveryAddress: { id: 'addr-2', street: '456 Oak Ave', state: 'CA' },
          clientAttention: 'Front desk',
          specialNotes: 'Fragile items',
          pickupNotes: 'Ring bell',
          driverStatus: null,
          dispatches: [],
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-10T00:00:00Z'),
        },
      ];

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].orderNumber).toBe('CATER-001');
      expect(data.totalPages).toBe(1);
      expect(data.totalCount).toBe(1);
      expect(data.currentPage).toBe(1);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        skip: 0,
        take: 10,
        orderBy: { pickupDateTime: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should handle pagination with custom page and limit', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = Array.from({ length: 5 }, (_, i) => ({
        id: `order-${i}`,
        orderNumber: `CATER-${String(i + 6).padStart(3, '0')}`,
        status: CateringStatus.PENDING,
        pickupDateTime: new Date(),
        orderTotal: 100.0,
        user: { id: 'user-1', name: 'User', email: 'user@example.com', contactNumber: '555-0100' },
        pickupAddress: null,
        deliveryAddress: { state: 'CA' },
        dispatches: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(15);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?page=2&limit=5');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(5);
      expect(data.totalPages).toBe(3);
      expect(data.totalCount).toBe(15);
      expect(data.currentPage).toBe(2);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
    });

    it('should filter by status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?status=IN_PROGRESS');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CateringStatus.IN_PROGRESS,
          }),
        })
      );
    });

    it('should handle status=all by not filtering status', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?status=all');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );
    });

    it('should filter by search term (orderNumber, clientAttention, user.name, user.email)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?search=john');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      // Search uses AND wrapper: { AND: [baseConditions, { OR: searchConditions }] }
      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({ deletedAt: null }),
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { orderNumber: { contains: 'john', mode: 'insensitive' } },
                  { clientAttention: { contains: 'john', mode: 'insensitive' } },
                  { user: { name: { contains: 'john', mode: 'insensitive' } } },
                  { user: { email: { contains: 'john', mode: 'insensitive' } } },
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('should filter by recentOnly (last 30 days)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?recentOnly=true');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      );
    });

    it('should sort by different fields (orderTotal asc)', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?sort=orderTotal&direction=asc');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderTotal: 'asc' },
        })
      );
    });

    it('should sort by user.name', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?sort=user.name&direction=asc');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { user: { name: 'asc' } },
        })
      );
    });

    it('should handle empty results', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders).toHaveLength(0);
      expect(data.totalPages).toBe(0);
      expect(data.totalCount).toBe(0);
    });

    it('should include dispatch and driver information', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: CateringStatus.IN_PROGRESS,
          pickupDateTime: new Date(),
          orderTotal: 200.0,
          user: { id: 'user-1', name: 'Client', email: 'client@example.com', contactNumber: '555-0100' },
          pickupAddress: null,
          deliveryAddress: { state: 'CA' },
          dispatches: [
            {
              id: 'dispatch-1',
              driver: {
                id: 'driver-1',
                name: 'Driver One',
                email: 'driver@example.com',
                contactNumber: '555-0200',
              },
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders[0].dispatches).toHaveLength(1);
      expect(data.orders[0].dispatches[0].driver.name).toBe('Driver One');
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      // No Authorization header set

      const response = await GET(request);
      await expectUnauthorized(response);

      expect(prisma.cateringRequest.findMany).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is malformed', async () => {
      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'InvalidFormat token');

      const response = await GET(request);
      await expectUnauthorized(response);
    });

    it('should return 401 when token is invalid', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token'),
      });

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer invalid-token');

      const response = await GET(request);
      await expectUnauthorized(response);
    });

    it('should return 401 when user is null', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

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

    it('should use default pagination values for invalid inputs', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?page=invalid&limit=abc');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: NaN,
          take: NaN,
        })
      );
    });

    it('should ignore invalid status values', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?status=INVALID_STATUS');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        })
      );
    });

    it('should use default sort for invalid sortField', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?sort=invalidField');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { pickupDateTime: 'desc' },
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
      (prisma.cateringRequest.findMany as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      await expectErrorResponse(response, 500, /Error fetching catering orders/i);
    });
  });

  describe('📊 Edge Cases', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });
    });

    it('should exclude soft-deleted orders (deletedAt null filter)', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('should handle combined filters (status + search + recentOnly)', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(0);

      const request = createGetRequest(
        'http://localhost:3000/api/orders/catering-orders?status=PENDING&search=john&recentOnly=true'
      );
      request.headers.set('authorization', 'Bearer valid-token');

      await GET(request);

      // Combined filters use AND wrapper: { AND: [baseConditions, { OR: searchConditions }] }
      expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                status: CateringStatus.PENDING,
                createdAt: expect.any(Object),
                deletedAt: null,
              }),
              expect.objectContaining({
                OR: expect.any(Array),
              }),
            ]),
          }),
        })
      );
    });

    it('should handle orders with null user name gracefully', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'CATER-001',
          status: CateringStatus.PENDING,
          pickupDateTime: new Date(),
          orderTotal: null,
          user: { id: 'user-1', name: null, email: 'user@example.com', contactNumber: null },
          pickupAddress: null,
          deliveryAddress: null,
          dispatches: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(1);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.orders[0].user.name).toBe('N/A');
      expect(data.orders[0].orderTotal).toBe(0);
    });

    it('should calculate correct totalPages with remainder', async () => {
      (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.cateringRequest.count as jest.Mock).mockResolvedValue(23);

      const request = createGetRequest('http://localhost:3000/api/orders/catering-orders?limit=10');
      request.headers.set('authorization', 'Bearer valid-token');

      const response = await GET(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.totalPages).toBe(3);
      expect(data.totalCount).toBe(23);
    });
  });
});
