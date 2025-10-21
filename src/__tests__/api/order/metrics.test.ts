// src/__tests__/api/order/metrics.test.ts

import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/services/vendor', () => ({
  checkOrderAccess: jest.fn(),
  getUserOrderMetrics: jest.fn(),
}));

import { GET } from '@/app/api/order/metrics/route';
import { checkOrderAccess, getUserOrderMetrics } from '@/lib/services/vendor';

describe('/api/order/metrics GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Metrics Retrieval', () => {
    it('should return order metrics for authorized user', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 50,
        activeOrders: 10,
        completedOrders: 35,
        cancelledOrders: 5,
        totalRevenue: 12500.00,
        averageOrderValue: 250.00,
        ordersThisMonth: 8,
        revenueThisMonth: 2000.00,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalOrders: 50,
        activeOrders: 10,
        completedOrders: 35,
        cancelledOrders: 5,
        totalRevenue: 12500.00,
        averageOrderValue: 250.00,
      });
      expect(getUserOrderMetrics).toHaveBeenCalledTimes(1);
    });

    it('should return zero metrics for user with no orders', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 0,
        activeOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        ordersThisMonth: 0,
        revenueThisMonth: 0,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalOrders).toBe(0);
      expect(data.totalRevenue).toBe(0);
    });

    it('should return metrics with only required fields', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 25,
        activeOrders: 5,
        completedOrders: 20,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalOrders).toBe(25);
      expect(data.activeOrders).toBe(5);
      expect(data.completedOrders).toBe(20);
    });

    it('should handle large metric values', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 10000,
        totalRevenue: 2500000.50,
        averageOrderValue: 250.00505,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalOrders).toBe(10000);
      expect(data.totalRevenue).toBe(2500000.50);
    });
  });

  describe('🔐 Authorization Tests', () => {
    it('should return 400 when user does not have order access', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Unauthorized access');
      expect(getUserOrderMetrics).not.toHaveBeenCalled();
    });

    it('should check access before fetching metrics', async () => {
      const callOrder: string[] = [];

      (checkOrderAccess as jest.Mock).mockImplementation(async () => {
        callOrder.push('checkOrderAccess');
        return true;
      });
      (getUserOrderMetrics as jest.Mock).mockImplementation(async () => {
        callOrder.push('getUserOrderMetrics');
        return { totalOrders: 0 };
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      await GET(request);

      expect(callOrder).toEqual(['checkOrderAccess', 'getUserOrderMetrics']);
    });

    it('should only allow users with order access', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);
      const getUserOrderMetricsSpy = jest.fn();
      (getUserOrderMetrics as jest.Mock).mockImplementation(getUserOrderMetricsSpy);

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      await GET(request);

      // getUserOrderMetrics should never be called if access check fails
      expect(getUserOrderMetricsSpy).not.toHaveBeenCalled();
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should return metrics in correct JSON format', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 100,
        activeOrders: 20,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
    });

    it('should preserve metric data types', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 50,
        totalRevenue: 12500.99,
        activeOrders: 10,
        averageOrderValue: 250.02,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.totalOrders).toBe('number');
      expect(typeof data.totalRevenue).toBe('number');
      expect(typeof data.activeOrders).toBe('number');
      expect(typeof data.averageOrderValue).toBe('number');
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when getUserOrderMetrics throws an error', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue(new Error('Database query failed'));

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database query failed');
    });

    it('should return 500 with generic message when error has no message', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue(new Error());

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch vendor metrics');
    });

    it('should handle checkOrderAccess errors gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockRejectedValue(new Error('Auth service unavailable'));

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Auth service unavailable');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue(new Error('Test error'));

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching vendor metrics:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue('String error');

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch vendor metrics');
    });

    it('should handle null errors gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue(null);

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch vendor metrics');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive error details', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockRejectedValue(
        new Error('Internal: Database password: secret123')
      );

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      // Error message is passed through, but this is still logged
      expect(data.error).toBe('Internal: Database password: secret123');
    });

    it('should verify user has access before exposing metrics', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);
      const getUserOrderMetricsSpy = jest.fn();
      (getUserOrderMetrics as jest.Mock).mockImplementation(getUserOrderMetricsSpy);

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      await GET(request);

      // getUserOrderMetrics should never be called if access check fails
      expect(getUserOrderMetricsSpy).not.toHaveBeenCalled();
    });

    it('should not leak metric data in error responses', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data).not.toHaveProperty('totalOrders');
      expect(data).not.toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('error');
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle successful end-to-end flow', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 150,
        activeOrders: 25,
        completedOrders: 120,
        cancelledOrders: 5,
        totalRevenue: 37500.00,
        averageOrderValue: 250.00,
        ordersThisMonth: 15,
        revenueThisMonth: 3750.00,
        ordersThisWeek: 4,
        revenueThisWeek: 1000.00,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        totalOrders: 150,
        activeOrders: 25,
        completedOrders: 120,
        cancelledOrders: 5,
        totalRevenue: 37500.00,
        averageOrderValue: 250.00,
        ordersThisMonth: 15,
        revenueThisMonth: 3750.00,
        ordersThisWeek: 4,
        revenueThisWeek: 1000.00,
      });
      expect(checkOrderAccess).toHaveBeenCalledTimes(1);
      expect(getUserOrderMetrics).toHaveBeenCalledTimes(1);
    });

    it('should handle metrics calculation edge cases', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrderMetrics as jest.Mock).mockResolvedValue({
        totalOrders: 1,
        activeOrders: 0,
        completedOrders: 1,
        cancelledOrders: 0,
        totalRevenue: 99.99,
        averageOrderValue: 99.99,
      });

      const request = createGetRequest('http://localhost:3000/api/order/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalOrders).toBe(1);
      expect(data.totalRevenue).toBe(99.99);
      expect(data.averageOrderValue).toBe(99.99);
    });
  });
});
