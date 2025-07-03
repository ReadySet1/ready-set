import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getVendorOrders, checkVendorAccess } from '@/lib/services/vendor';

// Mock dependencies
vi.mock('@/lib/services/vendor', () => ({
  getVendorOrders: vi.fn(),
  checkVendorAccess: vi.fn(),
}));

const mockGetVendorOrders = getVendorOrders as any;
const mockCheckVendorAccess = checkVendorAccess as any;

describe('Vendor Orders API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/vendor/orders', () => {
    it('should return paginated orders with default parameters', async () => {
      // Mock successful access check
      mockCheckVendorAccess.mockResolvedValue(true);

      // Mock orders response
      const mockResponse = {
        orders: [
          {
            id: 'order-1',
            orderNumber: 'TEST-001',
            orderType: 'catering',
            status: 'ACTIVE',
            pickupDateTime: '2024-01-01T10:00:00Z',
            arrivalDateTime: '2024-01-01T11:00:00Z',
            orderTotal: 100.50,
          },
        ],
        total: 5,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      mockGetVendorOrders.mockResolvedValue(mockResponse);

      // Create request without query parameters
      const request = new NextRequest('http://localhost:3000/api/vendor/orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);
      expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should handle pagination query parameters', async () => {
      mockCheckVendorAccess.mockResolvedValue(true);

      const mockResponse = {
        orders: [
          {
            id: 'order-2',
            orderNumber: 'TEST-002',
            orderType: 'on_demand',
            status: 'PENDING',
            pickupDateTime: '2024-01-02T10:00:00Z',
            arrivalDateTime: '2024-01-02T11:00:00Z',
            orderTotal: 75.25,
          },
        ],
        total: 10,
        page: 2,
        limit: 1,
        totalPages: 10,
      };

      mockGetVendorOrders.mockResolvedValue(mockResponse);

      // Create request with query parameters
      const request = new NextRequest(
        'http://localhost:3000/api/vendor/orders?page=2&limit=1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);
      expect(mockGetVendorOrders).toHaveBeenCalledWith(1, 2);
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      mockCheckVendorAccess.mockResolvedValue(true);

      const mockResponse = {
        orders: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockGetVendorOrders.mockResolvedValue(mockResponse);

      // Create request with invalid query parameters
      const request = new NextRequest(
        'http://localhost:3000/api/vendor/orders?page=abc&limit=xyz'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);
      // Should default to page 1 and limit 10 when invalid params are provided
      expect(mockGetVendorOrders).toHaveBeenCalledWith(10, 1);
    });

    it('should return 403 when user lacks vendor access', async () => {
      mockCheckVendorAccess.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/vendor/orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data).toEqual({
        error: 'Unauthorized access',
      });
      expect(mockGetVendorOrders).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockCheckVendorAccess.mockResolvedValue(true);
      mockGetVendorOrders.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/vendor/orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Database connection failed',
      });
    });

    it('should handle access check errors', async () => {
      mockCheckVendorAccess.mockRejectedValue(new Error('Auth service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/vendor/orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({
        error: 'Auth service unavailable',
      });
    });

    it('should handle page=0 and negative values', async () => {
      mockCheckVendorAccess.mockResolvedValue(true);

      const mockResponse = {
        orders: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockGetVendorOrders.mockResolvedValue(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/vendor/orders?page=0&limit=-5'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should clamp to minimum values: page=1, limit=1 when negative values are provided
      expect(mockGetVendorOrders).toHaveBeenCalledWith(1, 1);
    });

    it('should handle large limit values', async () => {
      mockCheckVendorAccess.mockResolvedValue(true);

      const mockResponse = {
        orders: [],
        total: 0,
        page: 1,
        limit: 1000,
        totalPages: 0,
      };

      mockGetVendorOrders.mockResolvedValue(mockResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/vendor/orders?limit=1000'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetVendorOrders).toHaveBeenCalledWith(1000, 1);
    });
  });
}); 