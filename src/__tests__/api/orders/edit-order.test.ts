// src/__tests__/api/orders/edit-order.test.ts
/**
 * Tests for PATCH /api/orders/[order_number]
 * Tests the admin order editing feature
 */

import {
  createPatchRequest,
  createMockCateringOrder,
  createMockOnDemandOrder,
  createMockAddress,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies BEFORE imports
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    onDemand: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    address: {
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/services/notifications/delivery-status', () => ({
  sendDispatchStatusNotification: jest.fn().mockResolvedValue(undefined),
}));

import { PATCH } from '@/app/api/orders/[order_number]/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';

describe('/api/orders/[order_number] PATCH API - Edit Order', () => {
  const mockCreateClient = createClient as jest.Mock;
  const mockCateringFindFirst = prisma.cateringRequest.findFirst as jest.Mock;
  const mockCateringUpdate = prisma.cateringRequest.update as jest.Mock;
  const mockOnDemandFindFirst = prisma.onDemand.findFirst as jest.Mock;
  const mockOnDemandUpdate = prisma.onDemand.update as jest.Mock;
  const mockAddressCreate = prisma.address.create as jest.Mock;
  const mockAddressUpdate = prisma.address.update as jest.Mock;

  // Helper to create mock params
  const createMockParams = (orderNumber: string) => ({
    params: Promise.resolve({ order_number: orderNumber }),
  });

  // Standard mock user setup
  const mockAdminUser = {
    id: 'admin-user-id',
    email: 'admin@example.com',
  };

  const mockClientUser = {
    id: 'client-user-id',
    email: 'client@example.com',
  };

  // Setup default mock responses
  const setupAuthenticatedAdmin = () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockAdminUser },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN' },
              error: null,
            }),
          }),
        }),
      }),
    });
  };

  const setupAuthenticatedClient = () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockClientUser },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { type: 'CLIENT' },
              error: null,
            }),
          }),
        }),
      }),
    });
  };

  const setupUnauthenticated = () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 when user is not authenticated', async () => {
      setupUnauthenticated();

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('🔒 Authorization Tests', () => {
    it('should return 403 when non-admin user tries to edit order fields', async () => {
      setupAuthenticatedClient();

      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.message).toBe('Insufficient permissions to edit orders');
    });

    it('should allow ADMIN role to edit orders', async () => {
      setupAuthenticatedAdmin();

      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 200 });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });

    it('should allow SUPER_ADMIN role to edit orders', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockAdminUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'SUPER_ADMIN' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 200 });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });

    it('should allow HELPDESK role to edit orders', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockAdminUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'HELPDESK' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 200 });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });
  });

  describe('🚫 Terminal Status Tests', () => {
    it('should return 400 when trying to edit a COMPLETED order', async () => {
      setupAuthenticatedAdmin();

      const mockOrder = createMockCateringOrder({
        orderNumber: 'CAT001',
        status: 'COMPLETED',
      });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Cannot edit order with status: COMPLETED');
    });

    it('should return 400 when trying to edit a CANCELLED order', async () => {
      setupAuthenticatedAdmin();

      const mockOrder = createMockCateringOrder({
        orderNumber: 'CAT001',
        status: 'CANCELLED',
      });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Cannot edit order with status: CANCELLED');
    });

    it('should return 400 when trying to edit a DELIVERED order', async () => {
      setupAuthenticatedAdmin();

      const mockOrder = createMockCateringOrder({
        orderNumber: 'CAT001',
        status: 'DELIVERED',
      });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('Cannot edit order with status: DELIVERED');
    });
  });

  describe('✏️ Catering Order Update Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should update order total successfully', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 250.00 });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 250 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCateringUpdate).toHaveBeenCalled();
    });

    it('should update pickup date/time successfully', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({
        ...mockOrder,
        pickupDateTime: new Date('2025-02-15T14:00:00Z'),
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { pickupDateTime: '2025-02-15T14:00:00Z' }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
      expect(mockCateringUpdate).toHaveBeenCalled();
    });

    it('should update headcount and needHost fields', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({
        ...mockOrder,
        headcount: 100,
        needHost: 'YES',
        hoursNeeded: 4,
        numberOfHosts: 2,
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {
          headcount: 100,
          needHost: 'YES',
          hoursNeeded: 4,
          numberOfHosts: 2,
        }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });

    it('should update notes fields', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({
        ...mockOrder,
        clientAttention: 'John Smith',
        pickupNotes: 'Use back entrance',
        specialNotes: 'Fragile items',
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {
          clientAttention: 'John Smith',
          pickupNotes: 'Use back entrance',
          specialNotes: 'Fragile items',
        }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });
  });

  describe('✏️ On-Demand Order Update Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should update on-demand order successfully', async () => {
      const mockOrder = createMockOnDemandOrder({ orderNumber: 'OND001', status: 'PENDING' });
      mockCateringFindFirst.mockResolvedValue(null); // Not a catering order
      mockOnDemandFindFirst.mockResolvedValue(mockOrder);
      mockOnDemandUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 100.00 });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/OND001',
        { orderTotal: 100 }
      );

      const response = await PATCH(request, createMockParams('OND001'));

      expect(response.status).toBe(200);
      expect(mockOnDemandUpdate).toHaveBeenCalled();
    });

    it('should update on-demand specific fields', async () => {
      const mockOrder = createMockOnDemandOrder({ orderNumber: 'OND001', status: 'PENDING' });
      mockCateringFindFirst.mockResolvedValue(null);
      mockOnDemandFindFirst.mockResolvedValue(mockOrder);
      mockOnDemandUpdate.mockResolvedValue({
        ...mockOrder,
        itemDelivered: 'Medical supplies',
        vehicleType: 'VAN',
        length: 24,
        width: 18,
        height: 12,
        weight: 50,
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/OND001',
        {
          itemDelivered: 'Medical supplies',
          vehicleType: 'VAN',
          length: 24,
          width: 18,
          height: 12,
          weight: 50,
        }
      );

      const response = await PATCH(request, createMockParams('OND001'));

      expect(response.status).toBe(200);
    });
  });

  describe('📍 Address Update Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should update existing pickup address', async () => {
      const mockOrder = createMockCateringOrder({
        orderNumber: 'CAT001',
        status: 'ACTIVE',
        pickupAddressId: 'existing-pickup-id',
      });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockAddressUpdate.mockResolvedValue({
        id: 'existing-pickup-id',
        street1: '999 New Pickup St',
        city: 'San Jose',
        state: 'CA',
        zip: '95101',
      });
      mockCateringUpdate.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {
          pickupAddress: {
            street1: '999 New Pickup St',
            city: 'San Jose',
            state: 'CA',
            zip: '95101',
          },
        }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
      expect(mockAddressUpdate).toHaveBeenCalled();
    });

    it('should create new address when no existing address', async () => {
      const mockOrder = createMockCateringOrder({
        orderNumber: 'CAT001',
        status: 'ACTIVE',
        deliveryAddressId: undefined,
      });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockAddressCreate.mockResolvedValue({
        id: 'new-delivery-id',
        street1: '123 New Delivery Ave',
        city: 'Oakland',
        state: 'CA',
        zip: '94601',
      });
      mockCateringUpdate.mockResolvedValue({
        ...mockOrder,
        deliveryAddressId: 'new-delivery-id',
      });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {
          deliveryAddress: {
            street1: '123 New Delivery Ave',
            city: 'Oakland',
            state: 'CA',
            zip: '94601',
          },
        }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });
  });

  describe('✅ Validation Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should return 400 when no update data is provided', async () => {
      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {}
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('No update data provided');
    });

    it('should return 400 for invalid orderTotal (negative)', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: -50 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Validation error');
    });

    it('should return 400 for invalid needHost value', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { needHost: 'MAYBE' }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Validation error');
    });

    it('should return 400 for invalid vehicleType value', async () => {
      const mockOrder = createMockOnDemandOrder({ orderNumber: 'OND001', status: 'PENDING' });
      mockCateringFindFirst.mockResolvedValue(null);
      mockOnDemandFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/OND001',
        { vehicleType: 'HELICOPTER' }
      );

      const response = await PATCH(request, createMockParams('OND001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Validation error');
    });

    it('should return 400 for invalid address with missing required fields', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        {
          pickupAddress: {
            street1: '123 Test St',
            // Missing city, state, zip
          },
        }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toBe('Validation error');
    });
  });

  describe('🔍 Order Not Found Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should return 404 when order does not exist', async () => {
      mockCateringFindFirst.mockResolvedValue(null);
      mockOnDemandFindFirst.mockResolvedValue(null);

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/NONEXISTENT',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('NONEXISTENT'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.message).toBe('Order not found');
    });
  });

  describe('📊 Status-Only Updates (Legacy Behavior)', () => {
    it('should allow status updates without role check (driver updates)', async () => {
      // Drivers can update status but not other fields
      mockCreateClient.mockResolvedValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'driver-id', email: 'driver@example.com' } },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { type: 'DRIVER' },
                error: null,
              }),
            }),
          }),
        }),
      });

      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, driverStatus: 'EN_ROUTE_TO_VENDOR' });

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { driverStatus: 'EN_ROUTE_TO_VENDOR' }
      );

      const response = await PATCH(request, createMockParams('CAT001'));

      expect(response.status).toBe(200);
    });
  });

  describe('❌ Error Handling Tests', () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it('should return 500 when database update fails', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockRejectedValue(new Error('Database connection failed'));

      const request = createPatchRequest(
        'http://localhost:3000/api/orders/CAT001',
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams('CAT001'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.message).toBe('Error updating order');
    });

    it('should handle URL encoded order numbers', async () => {
      const mockOrder = createMockCateringOrder({ orderNumber: 'CAT-001', status: 'ACTIVE' });
      mockCateringFindFirst.mockResolvedValue(mockOrder);
      mockCateringUpdate.mockResolvedValue({ ...mockOrder, orderTotal: 200 });

      const encodedOrderNumber = encodeURIComponent('CAT-001');
      const request = createPatchRequest(
        `http://localhost:3000/api/orders/${encodedOrderNumber}`,
        { orderTotal: 200 }
      );

      const response = await PATCH(request, createMockParams(encodedOrderNumber));

      expect(response.status).toBe(200);
    });
  });
});
