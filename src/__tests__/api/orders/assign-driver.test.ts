// src/__tests__/api/orders/assign-driver.test.ts

import { POST } from '@/app/api/orders/assignDriver/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { createPostRequest } from '@/__tests__/helpers/api-test-helpers';
import * as softDeleteHandlers from '@/lib/soft-delete-handlers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $transaction: jest.fn(),
    cateringRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    onDemand: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    dispatch: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('@/lib/soft-delete-handlers');

describe('/api/orders/assignDriver POST API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);

    // Default: driver validation passes
    (softDeleteHandlers.validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
      isValid: true,
      error: null,
    });
  });

  describe('🔐 Authentication Tests', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when user ID is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            email: 'test@example.com',
            // id is missing
          },
        },
        error: null,
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('✅ Input Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should return 400 when orderId is missing', async () => {
      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('orderId');
    });

    it('should return 400 when driverId is missing', async () => {
      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('driverId');
    });

    it('should return 400 when orderType is missing', async () => {
      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('orderType');
    });

    it('should return 400 when all required fields are missing', async () => {
      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {});

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('orderId');
      expect(data.error).toContain('driverId');
      expect(data.error).toContain('orderType');
    });
  });

  describe('🚫 Driver Validation Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should return 403 when driver is soft-deleted', async () => {
      (softDeleteHandlers.validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'Driver account has been deactivated',
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'deleted-driver-id',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Driver account has been deactivated');
    });

    it('should validate driver before processing assignment', async () => {
      (softDeleteHandlers.validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
        isValid: false,
        error: 'Driver not found',
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      await POST(request);

      expect(softDeleteHandlers.validateUserNotSoftDeleted).toHaveBeenCalledWith('driver-456');
    });
  });

  describe('📦 Catering Order Assignment Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should successfully assign driver to catering order with new dispatch', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'customer-789',
        status: 'PENDING',
      };

      const mockDispatch = {
        id: 'dispatch-999',
        driverId: 'driver-456',
        userId: 'customer-789',
        cateringRequestId: 'order-123',
        driver: {
          id: 'driver-456',
          name: 'John Driver',
          email: 'driver@example.com',
          contactNumber: '555-0100',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(null), // No existing dispatch
            create: jest.fn().mockResolvedValue(mockDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dispatch.driverId).toBe('driver-456');
      expect(data.updatedOrder.status).toBe('ASSIGNED');
    });

    it('should update existing dispatch for catering order', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'customer-789',
        status: 'PENDING',
      };

      const existingDispatch = {
        id: 'dispatch-999',
        driverId: 'old-driver-id',
        userId: 'customer-789',
        cateringRequestId: 'order-123',
      };

      const updatedDispatch = {
        ...existingDispatch,
        driverId: 'new-driver-id',
        driver: {
          id: 'new-driver-id',
          name: 'New Driver',
          email: 'newdriver@example.com',
          contactNumber: '555-0200',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(existingDispatch),
            update: jest.fn().mockResolvedValue(updatedDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'new-driver-id',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dispatch.driverId).toBe('new-driver-id');
    });

    it('should return 500 when catering order not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'nonexistent-order',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('catering order not found');
    });
  });

  describe('📦 On-Demand Order Assignment Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should successfully assign driver to on-demand order with new dispatch', async () => {
      const mockOrder = {
        id: 'order-456',
        userId: 'customer-789',
        status: 'PENDING',
      };

      const mockDispatch = {
        id: 'dispatch-888',
        driverId: 'driver-123',
        userId: 'customer-789',
        onDemandId: 'order-456',
        driver: {
          id: 'driver-123',
          name: 'Jane Driver',
          email: 'jane@example.com',
          contactNumber: '555-0300',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          onDemand: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-456',
        driverId: 'driver-123',
        orderType: 'on_demand',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dispatch.driverId).toBe('driver-123');
      expect(data.updatedOrder.status).toBe('ASSIGNED');
    });

    it('should update existing dispatch for on-demand order', async () => {
      const mockOrder = {
        id: 'order-456',
        userId: 'customer-789',
        status: 'PENDING',
      };

      const existingDispatch = {
        id: 'dispatch-888',
        driverId: 'old-driver-id',
        userId: 'customer-789',
        onDemandId: 'order-456',
      };

      const updatedDispatch = {
        ...existingDispatch,
        driverId: 'replacement-driver-id',
        driver: {
          id: 'replacement-driver-id',
          name: 'Replacement Driver',
          email: 'replacement@example.com',
          contactNumber: '555-0400',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          onDemand: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(existingDispatch),
            update: jest.fn().mockResolvedValue(updatedDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-456',
        driverId: 'replacement-driver-id',
        orderType: 'on_demand',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dispatch.driverId).toBe('replacement-driver-id');
    });

    it('should return 500 when on-demand order not found', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          onDemand: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'nonexistent-order',
        driverId: 'driver-123',
        orderType: 'on_demand',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('on_demand order not found');
    });
  });

  describe('❌ Error Handling Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should return 500 for invalid order type', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {};
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'invalid_type',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Invalid order type');
    });

    it('should handle Prisma errors gracefully', async () => {
      const prismaError = new Error('Database connection failed');
      (prismaError as any).code = 'P1001';

      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database error');
    });

    it('should handle general errors', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unexpected error');
    });

    it('should handle transaction rollback', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'order-123',
              userId: 'customer-789',
            }),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockRejectedValue(new Error('Constraint violation')),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe('📊 Response Format Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should return dispatch with driver information', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'customer-789',
        status: 'PENDING',
      };

      const mockDispatch = {
        id: 'dispatch-999',
        driverId: 'driver-456',
        userId: 'customer-789',
        cateringRequestId: 'order-123',
        driver: {
          id: 'driver-456',
          name: 'John Driver',
          email: 'driver@example.com',
          contactNumber: '555-0100',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('dispatch');
      expect(data).toHaveProperty('updatedOrder');
      expect(data.dispatch.driver).toHaveProperty('id');
      expect(data.dispatch.driver).toHaveProperty('name');
      expect(data.dispatch.driver).toHaveProperty('email');
      expect(data.dispatch.driver).toHaveProperty('contactNumber');
    });

    it('should serialize response data properly', async () => {
      const mockOrder = {
        id: 'order-123',
        userId: 'customer-789',
        status: 'PENDING',
        createdAt: new Date('2025-01-15T10:00:00Z'),
      };

      const mockDispatch = {
        id: 'dispatch-999',
        driverId: 'driver-456',
        userId: 'customer-789',
        cateringRequestId: 'order-123',
        driver: {
          id: 'driver-456',
          name: 'John Driver',
          email: 'driver@example.com',
          contactNumber: '555-0100',
        },
      };

      const mockUpdatedOrder = {
        ...mockOrder,
        status: 'ASSIGNED',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const mockPrismaContext = {
          cateringRequest: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockUpdatedOrder),
          },
          dispatch: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(mockDispatch),
          },
        };
        return callback(mockPrismaContext);
      });

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      // Date should be serialized to ISO string
      expect(typeof data.updatedOrder.createdAt).toBe('string');
    });
  });

  describe('🔒 Security Tests', () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      });
    });

    it('should handle database errors with Prisma code', async () => {
      const prismaError = new Error('Unique constraint failed on the fields');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['driverId'] };

      (prisma.$transaction as jest.Mock).mockRejectedValue(prismaError);

      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Database error');
      expect(data.error).toContain('Unique constraint failed');
    });

    it('should validate driver exists through soft-delete check', async () => {
      const request = createPostRequest('http://localhost:3000/api/orders/assignDriver', {
        orderId: 'order-123',
        driverId: 'driver-456',
        orderType: 'catering',
      });

      await POST(request);

      expect(softDeleteHandlers.validateUserNotSoftDeleted).toHaveBeenCalledWith('driver-456');
    });
  });
});
