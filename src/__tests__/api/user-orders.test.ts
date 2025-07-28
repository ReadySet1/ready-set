import { NextRequest } from 'next/server';
import { GET as getUserOrders } from '@/app/api/user-orders/route';
import { GET as getOrderDetail } from '@/app/api/user-orders/[order_number]/route';

// Mock Prisma
const mockPrisma = {
  cateringRequest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  onDemand: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.mock('@/utils/prismaDB', () => ({
  prisma: mockPrisma,
}));

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
};

jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('User Orders API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authenticated user
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null,
    });
  });

  describe('GET /api/user-orders', () => {
    test('returns orders with pagination data', async () => {
      const mockOrders = [
        {
          id: '1',
          orderNumber: 'SF-12360',
          status: 'ACTIVE',
          pickupDateTime: new Date('2025-07-30T12:00:00Z'),
          arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
          orderTotal: 234.00,
          createdAt: new Date('2025-07-30T12:00:00Z'),
          userId: 'user123',
          pickupAddress: {
            street1: '25 Winter St',
            city: 'South San Francisco',
            state: 'CA',
            zip: '94080',
          },
          deliveryAddress: {
            street1: '89 Spencer st',
            city: 'Burlingame',
            state: 'CA',
            zip: '94010',
          },
          user: { name: 'Test User', email: 'test@example.com' },
        },
      ];

      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
      mockPrisma.cateringRequest.count.mockResolvedValue(1);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user-orders?page=1&limit=5');
      const response = await getUserOrders(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('orders');
      expect(data).toHaveProperty('totalCount', 1);
      expect(data).toHaveProperty('totalPages', 1);
      expect(data).toHaveProperty('currentPage', 1);
      expect(data).toHaveProperty('limit', 5);
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders[0]).toHaveProperty('order_number', 'SF-12360');
    });

    test('handles authentication error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user-orders');
      const response = await getUserOrders(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    test('handles database errors gracefully', async () => {
      mockPrisma.cateringRequest.findMany.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user-orders');
      const response = await getUserOrders(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Error fetching user orders');
    });

    test('returns correct pagination for multiple pages', async () => {
      const mockOrders = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        orderNumber: `SF-${12360 + i}`,
        status: 'ACTIVE',
        pickupDateTime: new Date('2025-07-30T12:00:00Z'),
        arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
        orderTotal: 234.00,
        createdAt: new Date('2025-07-30T12:00:00Z'),
        userId: 'user123',
        pickupAddress: null,
        deliveryAddress: null,
        user: { name: 'Test User', email: 'test@example.com' },
      }));

      mockPrisma.cateringRequest.findMany.mockResolvedValue(mockOrders);
      mockPrisma.cateringRequest.count.mockResolvedValue(12);
      mockPrisma.onDemand.findMany.mockResolvedValue([]);
      mockPrisma.onDemand.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/user-orders?page=1&limit=5');
      const response = await getUserOrders(request);
      const data = await response.json();

      expect(data.totalCount).toBe(12);
      expect(data.totalPages).toBe(3); // Math.ceil(12 / 5)
      expect(data.currentPage).toBe(1);
    });
  });

  describe('GET /api/user-orders/[order_number]', () => {
    test('returns order details for valid order number', async () => {
      const mockOrder = {
        id: '1',
        orderNumber: 'SF-12360',
        status: 'ACTIVE',
        pickupDateTime: new Date('2025-07-30T12:00:00Z'),
        arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
        orderTotal: 234.00,
        createdAt: new Date('2025-07-30T12:00:00Z'),
        updatedAt: new Date('2025-07-30T12:00:00Z'),
        userId: 'user123',
        driverStatus: null,
        specialNotes: 'Handle with care',
        headcount: 40,
        pickupAddress: {
          street1: '25 Winter St',
          city: 'South San Francisco',
          state: 'CA',
          zip: '94080',
        },
        deliveryAddress: {
          street1: '89 Spencer st',
          city: 'Burlingame',
          state: 'CA',
          zip: '94010',
        },
        user: { name: 'Test User', email: 'test@example.com' },
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.onDemand.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user-orders/SF-12360');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'SF-12360' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('order_number', 'SF-12360');
      expect(data).toHaveProperty('order_type', 'catering');
      expect(data).toHaveProperty('status', 'active');
      expect(data).toHaveProperty('order_total', '234');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('delivery_address');
      expect(data).toHaveProperty('headcount', 40);
    });

    test('returns order details for on-demand order', async () => {
      const mockOrder = {
        id: '2',
        orderNumber: 'SF-12361',
        status: 'ACTIVE',
        pickupDateTime: new Date('2025-08-02T10:25:00Z'),
        arrivalDateTime: new Date('2025-08-02T11:00:00Z'),
        orderTotal: 230.00,
        createdAt: new Date('2025-08-02T10:25:00Z'),
        updatedAt: new Date('2025-08-02T10:25:00Z'),
        userId: 'user123',
        driverStatus: null,
        pickupAddress: {
          street1: '89 Spencer st',
          city: 'Burlingame',
          state: 'CA',
          zip: '94010',
        },
        deliveryAddress: {
          street1: '876 Laurel Street',
          city: 'San Carlos',
          state: 'CA',
          zip: '94070',
        },
        user: { name: 'Test User', email: 'test@example.com' },
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);
      mockPrisma.onDemand.findUnique.mockResolvedValue(mockOrder);

      const request = new NextRequest('http://localhost:3000/api/user-orders/SF-12361');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'SF-12361' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('order_number', 'SF-12361');
      expect(data).toHaveProperty('order_type', 'on_demand');
      expect(data).toHaveProperty('status', 'active');
      expect(data).toHaveProperty('order_total', '230');
    });

    test('returns 404 for non-existent order', async () => {
      mockPrisma.cateringRequest.findUnique.mockResolvedValue(null);
      mockPrisma.onDemand.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user-orders/INVALID-ORDER');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'INVALID-ORDER' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Order not found');
    });

    test('handles authentication error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/user-orders/SF-12360');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'SF-12360' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.message).toBe('Unauthorized');
    });

    test('handles database errors gracefully', async () => {
      mockPrisma.cateringRequest.findUnique.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user-orders/SF-12360');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'SF-12360' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Error fetching order');
    });

    test('correctly maps database fields to frontend format', async () => {
      const mockOrder = {
        id: '1',
        orderNumber: 'SF-12360',
        status: 'ACTIVE',
        pickupDateTime: new Date('2025-07-30T12:00:00Z'),
        arrivalDateTime: new Date('2025-07-30T12:45:00Z'),
        orderTotal: 234.00,
        createdAt: new Date('2025-07-30T12:00:00Z'),
        updatedAt: new Date('2025-07-30T12:00:00Z'),
        userId: 'user123',
        driverStatus: null,
        specialNotes: 'Handle with care',
        headcount: 40,
        pickupAddress: {
          street1: '25 Winter St',
          city: 'South San Francisco',
          state: 'CA',
          zip: '94080',
        },
        deliveryAddress: {
          street1: '89 Spencer st',
          city: 'Burlingame',
          state: 'CA',
          zip: '94010',
        },
        user: { name: 'Test User', email: 'test@example.com' },
        dispatches: [],
      };

      mockPrisma.cateringRequest.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.onDemand.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user-orders/SF-12360');
      const response = await getOrderDetail(request, {
        params: Promise.resolve({ order_number: 'SF-12360' }),
      });
      const data = await response.json();

      // Check field mapping
      expect(data.order_number).toBe('SF-12360'); // orderNumber -> order_number
      expect(data.order_total).toBe('234'); // orderTotal -> order_total
      expect(data.special_notes).toBe('Handle with care'); // specialNotes -> special_notes
      expect(data.user_id).toBe('user123'); // userId -> user_id
      expect(data.pickup_time).toBe('2025-07-30T12:00:00.000Z'); // pickupDateTime -> pickup_time
      expect(data.arrival_time).toBe('2025-07-30T12:45:00.000Z'); // arrivalDateTime -> arrival_time
      expect(data.address.street1).toBe('25 Winter St');
      expect(data.delivery_address.street1).toBe('89 Spencer st');
    });
  });
}); 