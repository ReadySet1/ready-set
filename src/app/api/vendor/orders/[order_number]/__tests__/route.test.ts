/**
 * Tests for /api/vendor/orders/[order_number] route
 *
 * This route fetches a single vendor order by order number.
 *
 * Tests cover:
 * - Authorization checks (403 for unauthorized)
 * - Successful order retrieval (200)
 * - Order not found (404)
 * - Error handling (500)
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getOrderByNumber, checkOrderAccess } from '@/lib/services/vendor';
import {
  createGetRequest,
  expectSuccessResponse,
  expectForbidden,
  expectNotFound,
  expectServerError,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/services/vendor', () => ({
  getOrderByNumber: jest.fn(),
  checkOrderAccess: jest.fn(),
}));

const mockGetOrderByNumber = getOrderByNumber as jest.MockedFunction<
  typeof getOrderByNumber
>;
const mockCheckOrderAccess = checkOrderAccess as jest.MockedFunction<
  typeof checkOrderAccess
>;

// Helper to create route params
const createParams = (orderNumber: string) =>
  Promise.resolve({ order_number: orderNumber });

describe('/api/vendor/orders/[order_number] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🔐 Authorization', () => {
    it('should return 403 when checkOrderAccess returns false', async () => {
      mockCheckOrderAccess.mockResolvedValue(false);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      await expectForbidden(response, /Unauthorized access/i);
      expect(mockGetOrderByNumber).not.toHaveBeenCalled();
    });

    it('should allow access when checkOrderAccess returns true', async () => {
      mockCheckOrderAccess.mockResolvedValue(true);
      mockGetOrderByNumber.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD001',
        orderType: 'catering',
        status: 'ACTIVE',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: null,
        orderTotal: 150.0,
        tip: 15.0,
        clientAttention: 'Reception desk',
        pickupAddress: {
          id: 'addr-1',
          street1: '123 Pickup St',
          street2: null,
          city: 'San Francisco',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'addr-2',
          street1: '456 Delivery Ave',
          street2: 'Suite 200',
          city: 'San Francisco',
          state: 'CA',
          zip: '94107',
        },
      });

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      expect(response.status).toBe(200);
      expect(mockGetOrderByNumber).toHaveBeenCalledWith('ORD001');
    });

    it('should handle checkOrderAccess errors gracefully', async () => {
      mockCheckOrderAccess.mockRejectedValue(new Error('Auth service error'));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      await expectServerError(response);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('📋 Parameter Handling', () => {
    beforeEach(() => {
      mockCheckOrderAccess.mockResolvedValue(true);
    });

    it('should decode URL-encoded order numbers', async () => {
      mockGetOrderByNumber.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-001',
        orderType: 'catering',
        status: 'ACTIVE',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: null,
        orderTotal: 100.0,
        tip: 10.0,
        clientAttention: null,
        pickupAddress: {
          id: 'p1',
          street1: '123 St',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'd1',
          street1: '456 Ave',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94107',
        },
      });

      const encodedOrderNumber = encodeURIComponent('ORD-001');
      const request = createGetRequest(
        `http://localhost:3000/api/vendor/orders/${encodedOrderNumber}`
      );

      const response = await GET(request, {
        params: createParams(encodedOrderNumber),
      });

      expect(response.status).toBe(200);
      expect(mockGetOrderByNumber).toHaveBeenCalledWith('ORD-001');
    });

    it('should handle special characters in order numbers', async () => {
      mockGetOrderByNumber.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'CAT#001/2025',
        orderType: 'catering',
        status: 'COMPLETED',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: '2025-01-15T11:30:00Z',
        orderTotal: 200.0,
        tip: 20.0,
        clientAttention: null,
        pickupAddress: {
          id: 'p1',
          street1: '123 St',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'd1',
          street1: '456 Ave',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94107',
        },
      });

      const encodedOrderNumber = encodeURIComponent('CAT#001/2025');
      const request = createGetRequest(
        `http://localhost:3000/api/vendor/orders/${encodedOrderNumber}`
      );

      const response = await GET(request, {
        params: createParams(encodedOrderNumber),
      });

      expect(response.status).toBe(200);
      expect(mockGetOrderByNumber).toHaveBeenCalledWith('CAT#001/2025');
    });
  });

  describe('✅ Successful Order Retrieval', () => {
    beforeEach(() => {
      mockCheckOrderAccess.mockResolvedValue(true);
    });

    it('should return catering order details', async () => {
      const mockOrder = {
        id: 'cat-order-1',
        orderNumber: 'CAT001',
        orderType: 'catering' as const,
        status: 'ACTIVE',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: null,
        orderTotal: 150.0,
        tip: 15.0,
        clientAttention: 'Reception desk',
        pickupAddress: {
          id: 'addr-1',
          street1: '123 Pickup St',
          street2: null,
          city: 'San Francisco',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'addr-2',
          street1: '456 Delivery Ave',
          street2: 'Suite 200',
          city: 'San Francisco',
          state: 'CA',
          zip: '94107',
        },
      };

      mockGetOrderByNumber.mockResolvedValue(mockOrder);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/CAT001'
      );

      const response = await GET(request, { params: createParams('CAT001') });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toEqual(mockOrder);
      expect(data.orderType).toBe('catering');
      expect(data.pickupAddress.city).toBe('San Francisco');
      expect(data.deliveryAddress.street2).toBe('Suite 200');
    });

    it('should return on-demand order details', async () => {
      const mockOrder = {
        id: 'ond-order-1',
        orderNumber: 'OND001',
        orderType: 'on_demand' as const,
        status: 'PENDING',
        pickupDateTime: '2025-01-16T14:00:00Z',
        arrivalDateTime: '2025-01-16T15:00:00Z',
        completeDateTime: null,
        orderTotal: 75.5,
        tip: 10.0,
        clientAttention: null,
        pickupAddress: {
          id: 'addr-3',
          street1: '789 Vendor Rd',
          street2: null,
          city: 'Oakland',
          state: 'CA',
          zip: '94612',
        },
        deliveryAddress: {
          id: 'addr-4',
          street1: '1000 Client St',
          street2: null,
          city: 'Oakland',
          state: 'CA',
          zip: '94607',
        },
      };

      mockGetOrderByNumber.mockResolvedValue(mockOrder);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/OND001'
      );

      const response = await GET(request, { params: createParams('OND001') });
      const data = await expectSuccessResponse(response, 200);

      expect(data.orderType).toBe('on_demand');
      expect(data.status).toBe('PENDING');
    });

    it('should include all expected order fields', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'TEST001',
        orderType: 'catering' as const,
        status: 'COMPLETED',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: '2025-01-15T11:30:00Z',
        orderTotal: 200.0,
        tip: 25.0,
        clientAttention: 'Test attention',
        pickupAddress: {
          id: 'p1',
          street1: '123 St',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'd1',
          street1: '456 Ave',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94107',
        },
      };

      mockGetOrderByNumber.mockResolvedValue(mockOrder);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/TEST001'
      );

      const response = await GET(request, { params: createParams('TEST001') });
      const data = await expectSuccessResponse(response, 200);

      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('orderNumber');
      expect(data).toHaveProperty('orderType');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('pickupDateTime');
      expect(data).toHaveProperty('arrivalDateTime');
      expect(data).toHaveProperty('completeDateTime');
      expect(data).toHaveProperty('orderTotal');
      expect(data).toHaveProperty('tip');
      expect(data).toHaveProperty('clientAttention');
      expect(data).toHaveProperty('pickupAddress');
      expect(data).toHaveProperty('deliveryAddress');
    });
  });

  describe('🔍 Order Not Found', () => {
    beforeEach(() => {
      mockCheckOrderAccess.mockResolvedValue(true);
    });

    it('should return null when order does not exist', async () => {
      mockGetOrderByNumber.mockResolvedValue(null);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/NONEXISTENT'
      );

      const response = await GET(request, {
        params: createParams('NONEXISTENT'),
      });

      // Note: The route returns NextResponse.json(order) without null check
      // so null is returned as 200 with null body
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeNull();
    });

    it('should return 404 when service throws Not Found error', async () => {
      mockGetOrderByNumber.mockRejectedValue(new Error('Not Found'));

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/MISSING'
      );

      const response = await GET(request, { params: createParams('MISSING') });

      await expectNotFound(response);
      const data = await response.json();
      expect(data.error).toBe('Order not found');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('❌ Error Handling', () => {
    beforeEach(() => {
      mockCheckOrderAccess.mockResolvedValue(true);
    });

    it('should return 500 on database error', async () => {
      mockGetOrderByNumber.mockRejectedValue(
        new Error('Database connection failed')
      );

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      await expectServerError(response);
      const data = await response.json();
      expect(data.error).toBe('Database connection failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching order:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return generic error message when error has no message', async () => {
      mockGetOrderByNumber.mockRejectedValue({});

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      await expectServerError(response);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch order details');

      consoleErrorSpy.mockRestore();
    });

    it('should handle unexpected error types gracefully', async () => {
      mockGetOrderByNumber.mockRejectedValue('Unexpected error type');

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation();

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/ORD001'
      );

      const response = await GET(request, { params: createParams('ORD001') });

      await expectServerError(response);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔢 Edge Cases', () => {
    beforeEach(() => {
      mockCheckOrderAccess.mockResolvedValue(true);
    });

    it('should handle order with null optional fields', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'TEST001',
        orderType: 'catering' as const,
        status: 'PENDING',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: null,
        orderTotal: 100.0,
        tip: 0,
        clientAttention: null,
        pickupAddress: {
          id: 'p1',
          street1: '123 St',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'd1',
          street1: '456 Ave',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94107',
        },
      };

      mockGetOrderByNumber.mockResolvedValue(mockOrder);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/TEST001'
      );

      const response = await GET(request, { params: createParams('TEST001') });
      const data = await expectSuccessResponse(response, 200);

      expect(data.completeDateTime).toBeNull();
      expect(data.clientAttention).toBeNull();
      expect(data.tip).toBe(0);
    });

    it('should handle order with zero total', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'FREE001',
        orderType: 'catering' as const,
        status: 'ACTIVE',
        pickupDateTime: '2025-01-15T10:00:00Z',
        arrivalDateTime: '2025-01-15T11:00:00Z',
        completeDateTime: null,
        orderTotal: 0,
        tip: 0,
        clientAttention: null,
        pickupAddress: {
          id: 'p1',
          street1: '123 St',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94103',
        },
        deliveryAddress: {
          id: 'd1',
          street1: '456 Ave',
          street2: null,
          city: 'SF',
          state: 'CA',
          zip: '94107',
        },
      };

      mockGetOrderByNumber.mockResolvedValue(mockOrder);

      const request = createGetRequest(
        'http://localhost:3000/api/vendor/orders/FREE001'
      );

      const response = await GET(request, { params: createParams('FREE001') });
      const data = await expectSuccessResponse(response, 200);

      expect(data.orderTotal).toBe(0);
    });
  });
});
