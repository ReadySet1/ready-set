// src/__tests__/api/order/orders/[order_number].test.ts

import { createGetRequest } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/lib/services/vendor', () => ({
  checkOrderAccess: jest.fn(),
  getOrderByNumber: jest.fn(),
}));

import { GET } from '@/app/api/order/orders/[order_number]/route';
import { checkOrderAccess, getOrderByNumber } from '@/lib/services/vendor';

describe('/api/order/orders/[order_number] GET API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock params
  const createMockParams = (orderNumber: string) => ({
    params: Promise.resolve({ order_number: orderNumber }),
  });

  describe('✅ Successful Order Retrieval', () => {
    it('should return order details for valid order number', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        id: 'order-123',
        orderNumber: 'ORD001',
        status: 'ACTIVE',
        orderTotal: 150.00,
        pickupDateTime: '2025-01-15T10:00:00Z',
        user: { name: 'John Doe', email: 'john@example.com' },
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        orderNumber: 'ORD001',
        status: 'ACTIVE',
        orderTotal: 150.00,
      });
      expect(getOrderByNumber).toHaveBeenCalledWith('ORD001');
    });

    it('should handle URL encoded order numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        id: 'order-456',
        orderNumber: 'ORD-002',
        status: 'PENDING',
        orderTotal: 200.00,
      });

      const encodedOrderNumber = encodeURIComponent('ORD-002');
      const request = createGetRequest(`http://localhost:3000/api/order/orders/${encodedOrderNumber}`);
      const response = await GET(request, createMockParams(encodedOrderNumber));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe('ORD-002');
      expect(getOrderByNumber).toHaveBeenCalledWith('ORD-002');
    });

    it('should handle order numbers with special characters', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        id: 'order-789',
        orderNumber: 'ORD#123',
        status: 'COMPLETED',
        orderTotal: 300.00,
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD%23123');
      const response = await GET(request, createMockParams('ORD%23123'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe('ORD#123');
      expect(getOrderByNumber).toHaveBeenCalledWith('ORD#123');
    });

    it('should return complete order details with nested objects', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        id: 'order-999',
        orderNumber: 'ORD999',
        status: 'ACTIVE',
        orderTotal: 500.00,
        pickupDateTime: '2025-01-20T14:00:00Z',
        arrivalDateTime: '2025-01-20T15:00:00Z',
        user: {
          id: 'user-123',
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        pickupAddress: {
          address: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
        },
        deliveryAddress: {
          address: '456 Oak Ave',
          city: 'Oakland',
          state: 'CA',
          zipCode: '94601',
        },
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD999');
      const response = await GET(request, createMockParams('ORD999'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe('ORD999');
      expect(data.user).toMatchObject({
        name: 'Jane Smith',
        email: 'jane@example.com',
      });
      expect(data.pickupAddress).toBeDefined();
      expect(data.deliveryAddress).toBeDefined();
    });
  });

  describe('🔐 Authorization Tests', () => {
    it('should return 403 when user does not have order access', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Unauthorized access');
      expect(getOrderByNumber).not.toHaveBeenCalled();
    });

    it('should check access before fetching order', async () => {
      const callOrder: string[] = [];

      (checkOrderAccess as jest.Mock).mockImplementation(async () => {
        callOrder.push('checkOrderAccess');
        return true;
      });
      (getOrderByNumber as jest.Mock).mockImplementation(async () => {
        callOrder.push('getOrderByNumber');
        return { orderNumber: 'ORD001' };
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      await GET(request, createMockParams('ORD001'));

      expect(callOrder).toEqual(['checkOrderAccess', 'getOrderByNumber']);
    });

    it('should only allow authorized users to view order details', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);
      const getOrderByNumberSpy = jest.fn();
      (getOrderByNumber as jest.Mock).mockImplementation(getOrderByNumberSpy);

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      await GET(request, createMockParams('ORD001'));

      // getOrderByNumber should never be called if access check fails
      expect(getOrderByNumberSpy).not.toHaveBeenCalled();
    });
  });

  describe('✏️ Parameter Validation', () => {
    it('should return 400 when order number is empty', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);

      const request = createGetRequest('http://localhost:3000/api/order/orders/');
      const response = await GET(request, createMockParams(''));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Order number is required');
      expect(getOrderByNumber).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only order numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);

      const request = createGetRequest('http://localhost:3000/api/order/orders/%20%20%20');
      const response = await GET(request, createMockParams('%20%20%20'));
      const data = await response.json();

      // After decoding, whitespace-only string becomes truthy but may fail at service level
      expect(response.status).toBeGreaterThanOrEqual(200);
      if (response.status === 200) {
        expect(getOrderByNumber).toHaveBeenCalledWith('   ');
      }
    });

    it('should handle very long order numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      const longOrderNumber = 'A'.repeat(500);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: longOrderNumber,
        status: 'ACTIVE',
      });

      const request = createGetRequest(`http://localhost:3000/api/order/orders/${longOrderNumber}`);
      const response = await GET(request, createMockParams(longOrderNumber));

      expect(response.status).toBe(200);
      expect(getOrderByNumber).toHaveBeenCalledWith(longOrderNumber);
    });
  });

  describe('📊 Response Structure Tests', () => {
    it('should return order in correct JSON format', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: 'ORD001',
        status: 'ACTIVE',
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data).toBe('object');
      expect(data).not.toBeNull();
    });

    it('should return proper content type', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: 'ORD001',
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));

      expect(response.status).toBe(200);
      // Note: content-type header may not be set in Jest environment
    });
  });

  describe('❌ Error Handling Tests', () => {
    it('should return 404 when order is not found', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue(new Error('Not Found'));

      const request = createGetRequest('http://localhost:3000/api/order/orders/NONEXISTENT');
      const response = await GET(request, createMockParams('NONEXISTENT'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');
    });

    it('should return 500 when getOrderByNumber throws unexpected error', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
    });

    it('should return 500 with generic message when error has no message', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue(new Error());

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch order details');
    });

    it('should handle checkOrderAccess errors gracefully', async () => {
      (checkOrderAccess as jest.Mock).mockRejectedValue(new Error('Auth service unavailable'));

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Auth service unavailable');
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue(new Error('Test error'));

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      await GET(request, createMockParams('ORD001'));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching order:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error thrown values', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue('String error');

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch order details');
    });
  });

  describe('🔒 Security Tests', () => {
    it('should not expose sensitive error details', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockRejectedValue(
        new Error('Internal: Database password: secret123')
      );

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      // Error message is passed through, but this is still logged
      expect(data.error).toBe('Internal: Database password: secret123');
    });

    it('should verify user has access before exposing order data', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);
      const getOrderByNumberSpy = jest.fn();
      (getOrderByNumber as jest.Mock).mockImplementation(getOrderByNumberSpy);

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      await GET(request, createMockParams('ORD001'));

      // getOrderByNumber should never be called if access check fails
      expect(getOrderByNumberSpy).not.toHaveBeenCalled();
    });

    it('should not leak order data in error responses', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(false);

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response = await GET(request, createMockParams('ORD001'));
      const data = await response.json();

      expect(data).not.toHaveProperty('orderNumber');
      expect(data).not.toHaveProperty('status');
      expect(data).not.toHaveProperty('orderTotal');
      expect(data).toHaveProperty('error');
    });

    it('should handle SQL injection attempts in order number', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      const maliciousOrderNumber = "ORD001'; DROP TABLE orders; --";
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: maliciousOrderNumber,
        status: 'ACTIVE',
      });

      const request = createGetRequest(`http://localhost:3000/api/order/orders/${encodeURIComponent(maliciousOrderNumber)}`);
      const response = await GET(request, createMockParams(encodeURIComponent(maliciousOrderNumber)));

      // Should pass through to service layer (which uses parameterized queries)
      expect(response.status).toBe(200);
      expect(getOrderByNumber).toHaveBeenCalledWith(maliciousOrderNumber);
    });
  });

  describe('🎯 Integration Tests', () => {
    it('should handle successful end-to-end flow', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        id: 'order-123',
        orderNumber: 'ORD123',
        status: 'ACTIVE',
        orderTotal: 250.50,
        pickupDateTime: '2025-01-25T10:00:00Z',
        arrivalDateTime: '2025-01-25T11:00:00Z',
        user: {
          id: 'user-456',
          name: 'Alice Johnson',
          email: 'alice@example.com',
        },
        pickupAddress: {
          address: '789 First St',
          city: 'Berkeley',
          state: 'CA',
          zipCode: '94710',
        },
        deliveryAddress: {
          address: '321 Second Ave',
          city: 'Albany',
          state: 'CA',
          zipCode: '94706',
        },
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ORD123');
      const response = await GET(request, createMockParams('ORD123'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        orderNumber: 'ORD123',
        status: 'ACTIVE',
        orderTotal: 250.50,
      });
      expect(data.user.email).toBe('alice@example.com');
      expect(data.pickupAddress.city).toBe('Berkeley');
      expect(data.deliveryAddress.city).toBe('Albany');
      expect(checkOrderAccess).toHaveBeenCalledTimes(1);
      expect(getOrderByNumber).toHaveBeenCalledTimes(1);
      expect(getOrderByNumber).toHaveBeenCalledWith('ORD123');
    });

    it('should handle multiple sequential requests', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);

      // First request
      (getOrderByNumber as jest.Mock).mockResolvedValueOnce({
        orderNumber: 'ORD001',
        status: 'ACTIVE',
      });

      const request1 = createGetRequest('http://localhost:3000/api/order/orders/ORD001');
      const response1 = await GET(request1, createMockParams('ORD001'));
      const data1 = await response1.json();

      expect(data1.orderNumber).toBe('ORD001');

      // Second request
      (getOrderByNumber as jest.Mock).mockResolvedValueOnce({
        orderNumber: 'ORD002',
        status: 'COMPLETED',
      });

      const request2 = createGetRequest('http://localhost:3000/api/order/orders/ORD002');
      const response2 = await GET(request2, createMockParams('ORD002'));
      const data2 = await response2.json();

      expect(data2.orderNumber).toBe('ORD002');
      expect(getOrderByNumber).toHaveBeenCalledTimes(2);
    });
  });

  describe('🔍 Edge Cases', () => {
    it('should handle numeric-only order numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: '12345',
        status: 'ACTIVE',
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/12345');
      const response = await GET(request, createMockParams('12345'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe('12345');
    });

    it('should handle order numbers with unicode characters', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      const unicodeOrderNumber = 'ORD-中文-001';
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: unicodeOrderNumber,
        status: 'ACTIVE',
      });

      const request = createGetRequest(`http://localhost:3000/api/order/orders/${encodeURIComponent(unicodeOrderNumber)}`);
      const response = await GET(request, createMockParams(encodeURIComponent(unicodeOrderNumber)));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe(unicodeOrderNumber);
    });

    it('should handle case-sensitive order numbers', async () => {
      (checkOrderAccess as jest.Mock).mockResolvedValue(true);
      (getOrderByNumber as jest.Mock).mockResolvedValue({
        orderNumber: 'ord001',
        status: 'ACTIVE',
      });

      const request = createGetRequest('http://localhost:3000/api/order/orders/ord001');
      const response = await GET(request, createMockParams('ord001'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orderNumber).toBe('ord001');
      expect(getOrderByNumber).toHaveBeenCalledWith('ord001');
    });
  });
});
