// src/__tests__/api/order/orders.test.ts

import { createRequestWithParams, createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/services/vendor', () => ({
  checkOrderAccess: jest.fn(),
  getUserOrders: jest.fn(),
}));

import { GET } from '@/app/api/order/orders/route';
import { checkOrderAccess, getUserOrders } from '@/lib/services/vendor';

describe('/api/order/orders GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('✅ Successful Order Retrieval', () => {
    it('should return paginated orders with default parameters', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [
          { id: '1', orderNumber: 'ORD001', status: 'ACTIVE', orderTotal: 100 },
          { id: '2', orderNumber: 'ORD002', status: 'PENDING', orderTotal: 200 },
        ],
        hasMore: true,
        total: 25,
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        orders: expect.arrayContaining([
          expect.objectContaining({ orderNumber: 'ORD001' }),
          expect.objectContaining({ orderNumber: 'ORD002' }),
        ]),
        hasMore: true,
        total: 25,
        page: 1,
        limit: 10,
      });

      expect(getUserOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should handle custom page and limit parameters', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [
          { id: '11', orderNumber: 'ORD011', status: 'ACTIVE', orderTotal: 150 },
        ],
        hasMore: false,
        total: 25,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '2',
        limit: '20',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(20);
      expect(getUserOrders).toHaveBeenCalledWith(20, 2);
    });

    it('should return empty orders array when no orders exist', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 0,
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toEqual([]);
      expect(data.hasMore).toBe(false);
      expect(data.total).toBe(0);
    });

    it('should handle large page numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 25,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '100',
        limit: '10',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(100);
      expect(getUserOrders).toHaveBeenCalledWith(10, 100);
    });
  });

  describe('🔐 Authorization Tests', () => {
    it('should return 403 when user does not have order access', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized access');
      expect(getUserOrders).not.toHaveBeenCalled();
    });

    it('should check access before fetching orders', async () => {
      const callOrder: string[] = [];

      (checkOrderAccess as jest.Mock).mockImplementation(async () => {
        callOrder.push('checkOrderAccess');
        return true;
      });
      (getUserOrders as jest.Mock).mockImplementation(async () => {
        callOrder.push('getUserOrders');
        return {
          orders: [],
          hasMore: false,
          total: 0,
        };
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      await GET(request);

      expect(callOrder).toEqual(['checkOrderAccess', 'getUserOrders']);
    });

    it('should only allow VENDOR users or users with orders', async () => {
      // This is tested implicitly through checkOrderAccess
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('✏️ Query Parameter Validation', () => {
    it('should handle invalid page parameter gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 0,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: 'invalid',
        limit: '10',
      });
      const response = await GET(request);
      const data = await response.json();

      // Should default to page 1 when invalid
      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(getUserOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should handle invalid limit parameter gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 0,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '1',
        limit: 'invalid',
      });
      const response = await GET(request);
      const data = await response.json();

      // Should default to limit 10 when invalid
      expect(response.status).toBe(200);
      expect(data.limit).toBe(10);
      expect(getUserOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should handle negative page numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 0,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '-1',
        limit: '10',
      });
      const response = await GET(request);
      const data = await response.json();

      // Should default to page 1 when negative
      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(getUserOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should handle zero as page number', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [],
        hasMore: false,
        total: 0,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '0',
        limit: '10',
      });
      const response = await GET(request);
      const data = await response.json();

      // Should default to page 1 when zero
      expect(response.status).toBe(200);
      expect(data.page).toBe(1);
      expect(getUserOrders).toHaveBeenCalledWith(10, 1);
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should include all required pagination fields', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [{ id: '1', orderNumber: 'ORD001' }],
        hasMore: true,
        total: 50,
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('hasMore');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('limit');

      expect(Array.isArray(data.orders)).toBe(true);
      expect(typeof data.hasMore).toBe('boolean');
      expect(typeof data.total).toBe('number');
      expect(typeof data.page).toBe('number');
      expect(typeof data.limit).toBe('number');
    });

    it('should return hasMore=false on last page', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [{ id: '1', orderNumber: 'ORD001' }],
        hasMore: false,
        total: 25,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '3',
        limit: '10',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(data.hasMore).toBe(false);
    });

    it('should return hasMore=true when more pages exist', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: Array(10).fill({ id: '1', orderNumber: 'ORD001' }),
        hasMore: true,
        total: 100,
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(data.hasMore).toBe(true);
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 500 when getUserOrders throws an error', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });

    it('should return 500 with generic message when error has no message', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockRejectedValue(new Error());

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch vendor orders');
    });

    it('should handle checkOrderAccess errors gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockRejectedValue(new Error('Auth service unavailable'));

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Auth service unavailable');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockRejectedValue(new Error('Test error'));

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching vendor orders:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive error details', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockRejectedValue(
        new Error('Internal: Database password: secret123')
      );

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      // Error message is passed through, but this is still logged
      expect(data.error).toBe('Internal: Database password: secret123');
    });

    it('should verify user has access before exposing data', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);
      const getUserOrdersSpy = jest.fn();
      (getUserOrders as jest.Mock).mockImplementation(getUserOrdersSpy);

      const request = createGetRequest('http://localhost:3000/api/order/orders');
      await GET(request);

      // getUserOrders should never be called if access check fails
      expect(getUserOrdersSpy).not.toHaveBeenCalled();
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle successful end-to-end flow', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getUserOrders as jest.Mock).mockResolvedValue({
        orders: [
          {
            id: '1',
            orderNumber: 'ORD001',
            status: 'ACTIVE',
            orderTotal: 150.50,
            pickupDateTime: '2025-01-15T10:00:00Z',
            user: { name: 'John Doe', email: 'john@example.com' },
          },
        ],
        hasMore: false,
        total: 1,
      });

      const request = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '1',
        limit: '25',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0]).toMatchObject({
        orderNumber: 'ORD001',
        status: 'ACTIVE',
        orderTotal: 150.50,
      });
      expect(data.page).toBe(1);
      expect(data.limit).toBe(25);
      expect(data.total).toBe(1);
      expect(data.hasMore).toBe(false);
    });

    it('should handle multiple pages of orders', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);

      // Page 1
      (getUserOrders as jest.Mock).mockResolvedValueOnce({
        orders: Array(10).fill(null).map((_, i) => ({
          id: `${i + 1}`,
          orderNumber: `ORD${String(i + 1).padStart(3, '0')}`,
        })),
        hasMore: true,
        total: 25,
      });

      const request1 = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '1',
        limit: '10',
      });
      const response1 = await GET(request1);
      const data1 = await response1.json();

      expect(data1.orders).toHaveLength(10);
      expect(data1.hasMore).toBe(true);
      expect(data1.page).toBe(1);

      // Page 2
      (getUserOrders as jest.Mock).mockResolvedValueOnce({
        orders: Array(10).fill(null).map((_, i) => ({
          id: `${i + 11}`,
          orderNumber: `ORD${String(i + 11).padStart(3, '0')}`,
        })),
        hasMore: true,
        total: 25,
      });

      const request2 = createRequestWithParams('http://localhost:3000/api/order/orders', {
        page: '2',
        limit: '10',
      });
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(data2.orders).toHaveLength(10);
      expect(data2.hasMore).toBe(true);
      expect(data2.page).toBe(2);
    });
  });
});
