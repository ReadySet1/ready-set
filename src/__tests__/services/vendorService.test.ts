/**
 * Unit Tests for Vendor Service
 *
 * Tests the vendor service functions with mocked auth and database.
 * Covers authentication, order access, data fetching, and metrics.
 *
 * Part of REA-315: Service Layer Unit Tests
 */

import {
  getCurrentUserId,
  checkOrderAccess,
  checkVendorAccess,
  getUserOrders,
  getUserOrderMetrics,
  getOrderByNumber,
} from '@/lib/services/vendor';
import { UserType } from '@/types/prisma';
import { CateringStatus, OnDemandStatus } from '@/types/prisma';
import {
  createMockProfile,
  createMockCateringRequestWithRelations,
  createMockOnDemandWithRelations,
  createMockVendor,
  resetIdCounter,
} from '../helpers/mock-data-factories';
import { createMockPrismaClient, resetPrismaMocks } from '../helpers/prisma-mock-helpers';
import { resetAllMocks } from '../helpers/service-test-utils';

// Mock the prisma module - use a factory function
jest.mock('@/lib/db/prisma', () => {
  const { createMockPrismaClient } = jest.requireActual('../helpers/prisma-mock-helpers');
  return {
    prisma: createMockPrismaClient(),
  };
});

// Mock the auth module
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn(),
}));

// Mock the database retry utility
jest.mock('@/utils/prismaDB', () => ({
  withDatabaseRetry: jest.fn().mockImplementation(async (fn) => fn()),
}));

// Import mocked modules after mocking
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth';

// Re-assign mock references for easier usage
const mockPrismaClient = prisma as unknown as ReturnType<typeof createMockPrismaClient>;
const mockGetCurrentUserFn = getCurrentUser as jest.Mock;

describe('VendorService', () => {
  beforeEach(() => {
    resetPrismaMocks(mockPrismaClient);
    resetIdCounter();
    mockGetCurrentUserFn.mockReset();
    jest.clearAllMocks();
  });

  describe('getCurrentUserId', () => {
    it('should return null when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      const result = await getCurrentUserId();

      expect(result).toBeNull();
    });

    it('should return null when user has no email', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ id: 'auth-123', email: null });

      const result = await getCurrentUserId();

      expect(result).toBeNull();
    });

    it('should return null when profile not found', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'test@example.com' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(null);

      const result = await getCurrentUserId();

      expect(result).toBeNull();
    });

    it('should return user ID when profile exists', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'test@example.com' });
      const mockProfile = createMockProfile({ id: 'user-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);

      const result = await getCurrentUserId();

      expect(result).toBe('user-123');
      expect(mockPrismaClient.profile.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: { id: true, type: true },
      });
    });
  });

  describe('checkOrderAccess', () => {
    it('should return false when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      const result = await checkOrderAccess();

      expect(result).toBe(false);
    });

    it('should return false when profile not found', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'test@example.com' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(null);

      const result = await checkOrderAccess();

      expect(result).toBe(false);
    });

    it('should return true for VENDOR type users', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockVendor = createMockVendor({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockVendor);

      const result = await checkOrderAccess();

      expect(result).toBe(true);
    });

    it('should return true for users with orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'client@example.com' });
      const mockClient = createMockProfile({ id: 'client-123', type: UserType.CLIENT });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockClient);
      mockPrismaClient.cateringRequest.count.mockResolvedValue(2);
      mockPrismaClient.onDemand.count.mockResolvedValue(0);

      const result = await checkOrderAccess();

      expect(result).toBe(true);
    });

    it('should return false for users without orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'client@example.com' });
      const mockClient = createMockProfile({ id: 'client-123', type: UserType.CLIENT });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockClient);
      mockPrismaClient.cateringRequest.count.mockResolvedValue(0);
      mockPrismaClient.onDemand.count.mockResolvedValue(0);

      const result = await checkOrderAccess();

      expect(result).toBe(false);
    });
  });

  describe('checkVendorAccess', () => {
    it('should return false when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      const result = await checkVendorAccess();

      expect(result).toBe(false);
    });

    it('should return false when user has no orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaClient.cateringRequest.findMany.mockResolvedValue([]);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([]);

      const result = await checkVendorAccess();

      expect(result).toBe(false);
    });

    it('should return true when user has orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);

      const mockOrder = createMockCateringRequestWithRelations({ userId: 'vendor-123' });
      mockPrismaClient.cateringRequest.findMany.mockResolvedValue([mockOrder]);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([]);

      const result = await checkVendorAccess();

      expect(result).toBe(true);
    });
  });

  describe('getUserOrders', () => {
    it('should throw error when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      await expect(getUserOrders()).rejects.toThrow('Unauthorized');
    });

    it('should return empty orders for user with no orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);
      mockPrismaClient.cateringRequest.findMany.mockResolvedValue([]);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([]);

      const result = await getUserOrders();

      expect(result.orders).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return combined and sorted orders', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);

      const now = new Date();
      const earlier = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const cateringOrder = createMockCateringRequestWithRelations({
        userId: 'vendor-123',
        pickupDateTime: now,
        orderNumber: 'CAT-001',
        orderTotal: 500,
        tip: 50,
      });

      const onDemandOrder = createMockOnDemandWithRelations({
        userId: 'vendor-123',
        pickupDateTime: earlier,
        orderNumber: 'OD-001',
        orderTotal: 100,
        tip: 10,
      });

      mockPrismaClient.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([onDemandOrder]);

      const result = await getUserOrders(10, 1);

      expect(result.orders).toHaveLength(2);
      // Should be sorted by pickupDateTime descending
      expect(result.orders[0].orderType).toBe('catering');
      expect(result.orders[1].orderType).toBe('on_demand');
    });

    it('should respect pagination', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);

      // Create multiple orders
      const orders = Array.from({ length: 15 }, (_, i) =>
        createMockCateringRequestWithRelations({
          userId: 'vendor-123',
          orderNumber: `CAT-${i.toString().padStart(3, '0')}`,
          pickupDateTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        })
      );

      mockPrismaClient.cateringRequest.findMany.mockResolvedValue(orders);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([]);

      const result = await getUserOrders(10, 1);

      expect(result.orders.length).toBeLessThanOrEqual(10);
      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(15);
    });

    it('should transform order data correctly', async () => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);

      const cateringOrder = createMockCateringRequestWithRelations({
        userId: 'vendor-123',
        orderNumber: 'CAT-001',
        status: CateringStatus.ACTIVE,
        orderTotal: 350.5,
        tip: 35.25,
        clientAttention: 'John Smith',
      });

      mockPrismaClient.cateringRequest.findMany.mockResolvedValue([cateringOrder]);
      mockPrismaClient.onDemand.findMany.mockResolvedValue([]);

      const result = await getUserOrders();

      const order = result.orders[0];
      expect(order.id).toBe(cateringOrder.id);
      expect(order.orderNumber).toBe('CAT-001');
      expect(order.orderType).toBe('catering');
      expect(order.status).toBe(CateringStatus.ACTIVE);
      expect(order.orderTotal).toBe(350.5);
      expect(order.tip).toBe(35.25);
      expect(order.clientAttention).toBe('John Smith');
      expect(order.pickupAddress).toBeDefined();
      expect(order.deliveryAddress).toBeDefined();
    });
  });

  describe('getUserOrderMetrics', () => {
    beforeEach(() => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);
    });

    it('should throw error when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      await expect(getUserOrderMetrics()).rejects.toThrow('Unauthorized');
    });

    it('should calculate active orders count', async () => {
      mockPrismaClient.cateringRequest.count
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(10) // completed
        .mockResolvedValueOnce(2) // cancelled
        .mockResolvedValueOnce(3) // pending
        .mockResolvedValueOnce(4) // recent
        .mockResolvedValueOnce(3); // previous

      mockPrismaClient.onDemand.count
        .mockResolvedValueOnce(3) // active
        .mockResolvedValueOnce(5) // completed
        .mockResolvedValueOnce(1) // cancelled
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(2) // recent
        .mockResolvedValueOnce(1); // previous

      mockPrismaClient.cateringRequest.aggregate.mockResolvedValue({
        _sum: { orderTotal: 5000, tip: 500 },
      });
      mockPrismaClient.onDemand.aggregate.mockResolvedValue({
        _sum: { orderTotal: 1000, tip: 100 },
      });

      const result = await getUserOrderMetrics();

      expect(result.activeOrders).toBe(8); // 5 + 3
      expect(result.completedOrders).toBe(15); // 10 + 5
      expect(result.cancelledOrders).toBe(3); // 2 + 1
      expect(result.pendingOrders).toBe(5); // 3 + 2
    });

    it('should calculate total revenue correctly', async () => {
      mockPrismaClient.cateringRequest.count.mockResolvedValue(0);
      mockPrismaClient.onDemand.count.mockResolvedValue(0);

      mockPrismaClient.cateringRequest.aggregate.mockResolvedValue({
        _sum: { orderTotal: 5000.5, tip: 500.25 },
      });
      mockPrismaClient.onDemand.aggregate.mockResolvedValue({
        _sum: { orderTotal: 1000.75, tip: 100.5 },
      });

      const result = await getUserOrderMetrics();

      expect(result.totalRevenue).toBe(6602); // 5000.5 + 500.25 + 1000.75 + 100.5
    });

    it('should calculate order growth percentage', async () => {
      mockPrismaClient.cateringRequest.count
        .mockResolvedValueOnce(0) // active
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(0) // cancelled
        .mockResolvedValueOnce(0) // pending
        .mockResolvedValueOnce(10) // recent orders (last 30 days)
        .mockResolvedValueOnce(8); // previous orders (30-60 days ago)

      mockPrismaClient.onDemand.count
        .mockResolvedValueOnce(0) // active
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(0) // cancelled
        .mockResolvedValueOnce(0) // pending
        .mockResolvedValueOnce(5) // recent
        .mockResolvedValueOnce(2); // previous

      mockPrismaClient.cateringRequest.aggregate.mockResolvedValue({
        _sum: { orderTotal: 0, tip: 0 },
      });
      mockPrismaClient.onDemand.aggregate.mockResolvedValue({
        _sum: { orderTotal: 0, tip: 0 },
      });

      const result = await getUserOrderMetrics();

      // Growth = ((15 - 10) / 10) * 100 = 50%
      expect(result.orderGrowth).toBe(50);
    });

    it('should handle zero previous orders for growth calculation', async () => {
      mockPrismaClient.cateringRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5) // recent
        .mockResolvedValueOnce(0); // previous = 0

      mockPrismaClient.onDemand.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0) // recent
        .mockResolvedValueOnce(0); // previous = 0

      mockPrismaClient.cateringRequest.aggregate.mockResolvedValue({
        _sum: { orderTotal: 0, tip: 0 },
      });
      mockPrismaClient.onDemand.aggregate.mockResolvedValue({
        _sum: { orderTotal: 0, tip: 0 },
      });

      const result = await getUserOrderMetrics();

      expect(result.orderGrowth).toBe(0);
    });
  });

  describe('getOrderByNumber', () => {
    beforeEach(() => {
      mockGetCurrentUserFn.mockResolvedValue({ email: 'vendor@example.com' });
      const mockProfile = createMockProfile({ id: 'vendor-123' });
      mockPrismaClient.profile.findUnique.mockResolvedValue(mockProfile);
    });

    it('should throw error when user is not authenticated', async () => {
      mockGetCurrentUserFn.mockResolvedValue(null);

      await expect(getOrderByNumber('CAT-001')).rejects.toThrow('Unauthorized');
    });

    it('should return catering order when found', async () => {
      const cateringOrder = createMockCateringRequestWithRelations({
        userId: 'vendor-123',
        orderNumber: 'CAT-001',
      });

      mockPrismaClient.cateringRequest.findFirst.mockResolvedValue(cateringOrder);

      const result = await getOrderByNumber('CAT-001');

      expect(result).not.toBeNull();
      expect(result?.orderNumber).toBe('CAT-001');
      expect(result?.orderType).toBe('catering');
    });

    it('should return on-demand order when catering not found', async () => {
      mockPrismaClient.cateringRequest.findFirst.mockResolvedValue(null);

      const onDemandOrder = createMockOnDemandWithRelations({
        userId: 'vendor-123',
        orderNumber: 'OD-001',
      });

      mockPrismaClient.onDemand.findFirst.mockResolvedValue(onDemandOrder);

      const result = await getOrderByNumber('OD-001');

      expect(result).not.toBeNull();
      expect(result?.orderNumber).toBe('OD-001');
      expect(result?.orderType).toBe('on_demand');
    });

    it('should return null when order not found in either table', async () => {
      mockPrismaClient.cateringRequest.findFirst.mockResolvedValue(null);
      mockPrismaClient.onDemand.findFirst.mockResolvedValue(null);

      const result = await getOrderByNumber('UNKNOWN-001');

      expect(result).toBeNull();
    });

    it('should only find orders belonging to current user', async () => {
      const userId = 'vendor-123';
      mockPrismaClient.cateringRequest.findFirst.mockResolvedValue(null);
      mockPrismaClient.onDemand.findFirst.mockResolvedValue(null);

      await getOrderByNumber('CAT-001');

      expect(mockPrismaClient.cateringRequest.findFirst).toHaveBeenCalledWith({
        where: {
          orderNumber: 'CAT-001',
          userId,
        },
        include: {
          pickupAddress: true,
          deliveryAddress: true,
        },
      });
    });
  });
});
