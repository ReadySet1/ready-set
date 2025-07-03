import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVendorOrders, PaginatedOrdersResponse } from '../vendor';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth';

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    cateringRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    onDemand: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

const mockPrisma = prisma as any;
const mockGetCurrentUser = getCurrentUser as any;

describe('Vendor Service Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock authenticated user
    mockGetCurrentUser.mockResolvedValue({
      email: 'vendor@test.com',
    });
    
    // Mock profile lookup
    mockPrisma.profile.findUnique.mockResolvedValue({
      id: 'vendor-user-id',
      type: 'VENDOR',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getVendorOrders pagination', () => {
    it('should return paginated orders with correct structure', async () => {
      // Mock data
      const mockCateringOrders = [
        {
          id: 'catering-1',
          orderNumber: 'CAT-001',
          status: 'ACTIVE',
          pickupDateTime: new Date('2024-01-01T10:00:00Z'),
          arrivalDateTime: new Date('2024-01-01T11:00:00Z'),
          completeDateTime: null,
          orderTotal: 100.50,
          tip: 15.00,
          clientAttention: 'Test client',
          pickupAddress: {
            id: 'pickup-1',
            street1: '123 Pickup St',
            street2: null,
            city: 'Pickup City',
            state: 'CA',
            zip: '12345',
          },
          deliveryAddress: {
            id: 'delivery-1',
            street1: '456 Delivery St',
            street2: null,
            city: 'Delivery City',
            state: 'CA',
            zip: '67890',
          },
        },
      ];

      const mockOnDemandOrders = [
        {
          id: 'ondemand-1',
          orderNumber: 'OD-001',
          status: 'PENDING',
          pickupDateTime: new Date('2024-01-02T10:00:00Z'),
          arrivalDateTime: new Date('2024-01-02T11:00:00Z'),
          completeDateTime: null,
          orderTotal: 75.25,
          tip: 10.00,
          clientAttention: 'Test client 2',
          pickupAddress: {
            id: 'pickup-2',
            street1: '789 Pickup St',
            street2: null,
            city: 'Pickup City 2',
            state: 'CA',
            zip: '54321',
          },
          deliveryAddress: {
            id: 'delivery-2',
            street1: '012 Delivery St',
            street2: null,
            city: 'Delivery City 2',
            state: 'CA',
            zip: '09876',
          },
        },
      ];

      // Mock counts
      mockPrisma.cateringRequest.count.mockResolvedValue(5);
      mockPrisma.onDemand.count.mockResolvedValue(3);

      // Mock findMany
      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
      mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);

      const result = await getVendorOrders(1, 1);

      expect(result).toEqual({
        orders: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            orderNumber: expect.any(String),
            orderType: expect.stringMatching(/^(catering|on_demand)$/),
            status: expect.any(String),
            pickupDateTime: expect.any(String),
            arrivalDateTime: expect.any(String),
            orderTotal: expect.any(Number),
          }),
        ]),
        total: 8,
        page: 1,
        limit: 1,
        totalPages: 8,
      });
    });

    it('should handle pagination parameters correctly', async () => {
      // Mock empty results
      mockPrisma.cateringRequest.count.mockResolvedValue(10);
      mockPrisma.onDemand.count.mockResolvedValue(5);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const result = await getVendorOrders(2, 3);

      expect(result).toEqual({
        orders: [],
        total: 15,
        page: 3,
        limit: 2,
        totalPages: 8, // Math.ceil(15/2) = 8
      });
    });

    it('should handle empty results', async () => {
      mockPrisma.cateringRequest.count.mockResolvedValue(0);
      mockPrisma.onDemand.count.mockResolvedValue(0);
      mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);

      const result = await getVendorOrders(1, 1);

      expect(result).toEqual({
        orders: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0,
      });
    });

    it('should sort orders by pickup date descending', async () => {
      const mockCateringOrders = [
        {
          id: 'catering-1',
          orderNumber: 'CAT-001',
          status: 'ACTIVE',
          pickupDateTime: new Date('2024-01-01T10:00:00Z'), // Older
          arrivalDateTime: new Date('2024-01-01T11:00:00Z'),
          completeDateTime: null,
          orderTotal: 100.50,
          tip: 15.00,
          clientAttention: 'Test client',
          pickupAddress: {
            id: 'pickup-1',
            street1: '123 Pickup St',
            street2: null,
            city: 'Pickup City',
            state: 'CA',
            zip: '12345',
          },
          deliveryAddress: {
            id: 'delivery-1',
            street1: '456 Delivery St',
            street2: null,
            city: 'Delivery City',
            state: 'CA',
            zip: '67890',
          },
        },
      ];

      const mockOnDemandOrders = [
        {
          id: 'ondemand-1',
          orderNumber: 'OD-001',
          status: 'PENDING',
          pickupDateTime: new Date('2024-01-02T10:00:00Z'), // Newer
          arrivalDateTime: new Date('2024-01-02T11:00:00Z'),
          completeDateTime: null,
          orderTotal: 75.25,
          tip: 10.00,
          clientAttention: 'Test client 2',
          pickupAddress: {
            id: 'pickup-2',
            street1: '789 Pickup St',
            street2: null,
            city: 'Pickup City 2',
            state: 'CA',
            zip: '54321',
          },
          deliveryAddress: {
            id: 'delivery-2',
            street1: '012 Delivery St',
            street2: null,
            city: 'Delivery City 2',
            state: 'CA',
            zip: '09876',
          },
        },
      ];

      mockPrisma.cateringRequest.count.mockResolvedValue(1);
      mockPrisma.onDemand.count.mockResolvedValue(1);
      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
      mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);

      const result = await getVendorOrders(10, 1);

      // First order should be the newer one (on-demand)
      expect(result.orders).toHaveLength(2);
      expect(result.orders[0]?.orderNumber).toBe('OD-001');
      expect(result.orders[1]?.orderNumber).toBe('CAT-001');
    });

    it('should throw error when user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(getVendorOrders(1, 1)).rejects.toThrow('Unauthorized');
    });
  });
}); 