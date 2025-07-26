import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user-orders/route';

// Mock the dependencies
vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id' } }
      }))
    }
  }))
}));

// Mock prisma with inline mocks to avoid hoisting issues
vi.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    onDemand: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    $disconnect: vi.fn()
  }
}));

describe('User Orders API', () => {
  let mockPrisma: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Get the mocked prisma instance
    const { prisma } = require('@/utils/prismaDB');
    mockPrisma = prisma;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/user-orders', () => {
    it('should return orders with pagination data', async () => {
      // Mock data
      const mockCateringOrders = [
        {
          id: '1',
          orderNumber: 'CAT-001',
          status: 'ACTIVE',
          createdAt: new Date('2025-01-01'),
          arrivalDateTime: new Date('2025-01-02'),
          pickupDateTime: new Date('2025-01-01'),
          orderTotal: 100.00,
          client_attention: 'Test Order',
          pickupAddress: {
            street1: '123 Test St',
            city: 'Test City',
            state: 'CA'
          },
          deliveryAddress: {
            street1: '456 Delivery St',
            city: 'Delivery City',
            state: 'CA'
          }
        }
      ];

      const mockOnDemandOrders = [
        {
          id: '2',
          orderNumber: 'OND-001',
          status: 'ACTIVE',
          createdAt: new Date('2025-01-03'),
          arrivalDateTime: new Date('2025-01-04'),
          pickupDateTime: new Date('2025-01-03'),
          orderTotal: 200.00,
          client_attention: 'Test OnDemand',
          pickupAddress: {
            street1: '789 Pickup St',
            city: 'Pickup City',
            state: 'CA'
          },
          deliveryAddress: {
            street1: '012 Delivery St',
            city: 'Delivery City',
            state: 'CA'
          }
        }
      ];

      // Mock prisma responses
      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
      mockPrisma.cateringRequest.count.mockResolvedValue(5);
      mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);
      mockPrisma.onDemand.count.mockResolvedValue(3);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/user-orders?page=1&limit=5');

      // Call the API
      const response = await GET(request);
      const data = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('totalCount');
      expect(data).toHaveProperty('currentPage');
      expect(data).toHaveProperty('totalPages');

      expect(data.totalCount).toBe(8); // 5 catering + 3 onDemand
      expect(data.currentPage).toBe(1);
      expect(data.totalPages).toBe(2); // Math.ceil(8/5) = 2

      expect(data.orders).toHaveLength(2); // Combined orders
      expect(data.orders[0]).toHaveProperty('order_number');
      expect(data.orders[0].order_number).toBe('CAT-001');
      expect(data.orders[1].order_number).toBe('OND-001');
    });

    it('should handle pagination correctly', async () => {
      // Mock empty results for page 2
      mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
      mockPrisma.cateringRequest.count.mockResolvedValue(5);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.count.mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/user-orders?page=2&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalCount).toBe(8);
      expect(data.currentPage).toBe(2);
      expect(data.totalPages).toBe(2);
      expect(data.orders).toHaveLength(0); // No orders on page 2 with limit 5
    });

    it('should handle catering-only orders', async () => {
      const mockCateringOrders = [
        {
          id: '1',
          orderNumber: 'CAT-001',
          status: 'ACTIVE',
          createdAt: new Date('2025-01-01'),
          arrivalDateTime: new Date('2025-01-02'),
          pickupDateTime: new Date('2025-01-01'),
          orderTotal: 100.00,
          client_attention: 'Test Order',
          pickupAddress: {
            street1: '123 Test St',
            city: 'Test City',
            state: 'CA'
          },
          deliveryAddress: {
            street1: '456 Delivery St',
            city: 'Delivery City',
            state: 'CA'
          }
        }
      ];

      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockCateringOrders);
      mockPrisma.cateringRequest.count.mockResolvedValue(1);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user-orders?type=catering&page=1&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalCount).toBe(1);
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].order_type).toBe('catering');
    });

    it('should handle on-demand-only orders', async () => {
      const mockOnDemandOrders = [
        {
          id: '1',
          orderNumber: 'OND-001',
          status: 'ACTIVE',
          createdAt: new Date('2025-01-01'),
          arrivalDateTime: new Date('2025-01-02'),
          pickupDateTime: new Date('2025-01-01'),
          orderTotal: 200.00,
          client_attention: 'Test OnDemand',
          pickupAddress: {
            street1: '789 Pickup St',
            city: 'Pickup City',
            state: 'CA'
          },
          deliveryAddress: {
            street1: '012 Delivery St',
            city: 'Delivery City',
            state: 'CA'
          }
        }
      ];

      mockPrisma.cateringRequest.findMany.mockResolvedValue([]);
      mockPrisma.cateringRequest.count.mockResolvedValue(0);
      mockPrisma.onDemand.findMany.mockResolvedValue(mockOnDemandOrders);
      mockPrisma.onDemand.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/user-orders?type=on_demand&page=1&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalCount).toBe(1);
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].order_type).toBe('on_demand');
    });

    it('should use delivery date instead of creation date', async () => {
      const mockOrder = {
        id: '1',
        orderNumber: 'TEST-001',
        status: 'ACTIVE',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        arrivalDateTime: new Date('2025-01-02T15:00:00Z'),
        pickupDateTime: new Date('2025-01-01T12:00:00Z'),
        orderTotal: 100.00,
        client_attention: 'Test Order',
        pickupAddress: {
          street1: '123 Test St',
          city: 'Test City',
          state: 'CA'
        },
        deliveryAddress: {
          street1: '456 Delivery St',
          city: 'Delivery City',
          state: 'CA'
        }
      };

      mockPrisma.cateringRequest.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.cateringRequest.count.mockResolvedValue(1);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user-orders?page=1&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.orders[0].date).toBe('2025-01-02T15:00:00.000Z'); // Should use arrivalDateTime
    });

    it('should handle unauthorized requests', async () => {
      // Mock unauthorized user
      const { createClient } = require('@/utils/supabase/server');
      createClient.mockReturnValue({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null }
          }))
        }
      });

      const request = new NextRequest('http://localhost:3000/api/user-orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValue(new Error('Database error'));
      mockPrisma.cateringRequest.count.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user-orders');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Error fetching user orders');
    });
  });
}); 