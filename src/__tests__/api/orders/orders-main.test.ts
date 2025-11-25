// src/__tests__/api/orders/orders-main.test.ts

import { GET } from '@/app/api/orders/route';
import { validateApiAuth } from '@/utils/api-auth';
import { prisma } from '@/utils/prismaDB';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Set test timeout to prevent worker crashes
jest.setTimeout(10000);

// Mock dependencies
jest.mock('@/utils/api-auth');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    cateringRequest: {
      findMany: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({})),
}));
jest.mock('@/app/actions/email', () => ({
  sendOrderConfirmationEmail: jest.fn(),
  sendOrderNotificationEmail: jest.fn(),
}));

describe('/api/orders API - Main Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/orders - List All Orders', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return combined catering and on-demand orders', async () => {
        // Mock authentication
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', email: 'user@example.com', type: 'CLIENT' },
        });

        // Mock database responses
        const mockCateringOrders = [
          {
            id: 'catering-1',
            orderNumber: 'CAT-001',
            status: 'PENDING',
            orderTotal: 250.0,
            user: {
              id: 'user-123',
              name: 'John Doe',
              email: 'john@example.com',
              userAddresses: [],
            },
            pickupAddress: {
              id: 'addr-1',
              street1: '123 Vendor St',
              city: 'Austin',
              state: 'TX',
            },
            deliveryAddress: {
              id: 'addr-2',
              street1: '456 Client Ave',
              city: 'Austin',
              state: 'TX',
            },
            dispatches: [],
            fileUploads: [],
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
          },
        ];

        const mockOnDemandOrders = [
          {
            id: 'ondemand-1',
            orderNumber: 'OD-001',
            status: 'COMPLETED',
            orderTotal: 75.5,
            user: {
              id: 'user-456',
              name: 'Jane Smith',
              email: 'jane@example.com',
              userAddresses: [],
            },
            pickupAddress: {
              id: 'addr-3',
              street1: '789 Pickup Ln',
              city: 'Austin',
              state: 'TX',
            },
            deliveryAddress: {
              id: 'addr-4',
              street1: '321 Delivery Rd',
              city: 'Austin',
              state: 'TX',
            },
            dispatches: [],
            fileUploads: [],
            createdAt: new Date('2024-01-03'),
            updatedAt: new Date('2024-01-04'),
          },
        ];

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(
          mockCateringOrders
        );
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(
          mockOnDemandOrders
        );

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data.orders).toHaveLength(2);
        expect(data.totalCount).toBe(2);

        // Verify both types of orders are included
        const cateringOrder = data.orders.find((o: any) => o.type === 'catering');
        const onDemandOrder = data.orders.find((o: any) => o.type === 'ondemand');

        expect(cateringOrder).toBeDefined();
        expect(cateringOrder.orderNumber).toBe('CAT-001');
        expect(onDemandOrder).toBeDefined();
        expect(onDemandOrder.orderNumber).toBe('OD-001');
      });

      it('should support pagination with skip and take', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?take=20&skip=10'
        );

        await GET(request);

        // Verify pagination was applied
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 10,
          })
        );
        expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 10,
          })
        );
      });

      it('should support status filtering', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'VENDOR' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?status=PENDING'
        );

        await GET(request);

        // Verify status filter was applied
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PENDING',
            }),
          })
        );
        expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              status: 'PENDING',
            }),
          })
        );
      });

      it('should support search by order number', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?search=CAT-001'
        );

        await GET(request);

        // Verify search was applied with OR conditions
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  orderNumber: { contains: 'CAT-001', mode: 'insensitive' },
                }),
              ]),
            }),
          })
        );
      });

      it('should support search by user name', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'ADMIN' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?search=John'
        );

        await GET(request);

        // Verify search was applied for user name
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  user: expect.objectContaining({
                    OR: expect.arrayContaining([
                      { name: { contains: 'John', mode: 'insensitive' } },
                    ]),
                  }),
                }),
              ]),
            }),
          })
        );
      });

      it('should support search by user email', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'ADMIN' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?search=john@example.com'
        );

        await GET(request);

        // Verify search was applied for user email
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  user: expect.objectContaining({
                    OR: expect.arrayContaining([
                      { email: { contains: 'john@example.com', mode: 'insensitive' } },
                    ]),
                  }),
                }),
              ]),
            }),
          })
        );
      });

      it('should support custom sorting', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/orders?sortBy=orderTotal&sortOrder=asc'
        );

        await GET(request);

        // Verify sorting was applied
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              orderTotal: 'asc',
            },
          })
        );
        expect(prisma.onDemand.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              orderTotal: 'asc',
            },
          })
        );
      });

      it('should default to sorting by createdAt desc', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/orders');

        await GET(request);

        // Verify default sorting
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        );
      });

      it('should include related data (dispatches, addresses, user, files)', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/orders');

        await GET(request);

        // Verify includes were applied
        expect(prisma.cateringRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: expect.objectContaining({
              dispatches: expect.objectContaining({
                include: expect.objectContaining({
                  driver: true,
                }),
              }),
              user: expect.objectContaining({
                include: expect.objectContaining({
                  userAddresses: expect.objectContaining({
                    include: expect.objectContaining({
                      address: true,
                    }),
                  }),
                }),
              }),
              pickupAddress: true,
              deliveryAddress: true,
              fileUploads: true,
            }),
          })
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: false,
          user: null,
        });

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        await expectUnauthorized(response, /Authentication required/i);
      });

      it('should return 401 when user is null', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: null,
        });

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 for invalid authentication', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: false,
          user: null,
          error: 'Invalid token',
        });

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        expect(response.status).toBe(401);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors from catering orders', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle database errors from on-demand orders', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle authentication service errors', async () => {
        (validateApiAuth as jest.Mock).mockRejectedValue(
          new Error('Auth service unavailable')
        );

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📊 Data Transformation', () => {
      it('should transform orders with correct type field', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'catering-1',
            orderNumber: 'CAT-001',
            status: 'PENDING',
            orderTotal: 100,
            user: {},
            pickupAddress: {},
            deliveryAddress: {},
            dispatches: [],
            fileUploads: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'ondemand-1',
            orderNumber: 'OD-001',
            status: 'COMPLETED',
            orderTotal: 50,
            user: {},
            pickupAddress: {},
            deliveryAddress: {},
            dispatches: [],
            fileUploads: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Verify each order has correct type
        const cateringOrder = data.orders.find((o: any) => o.id === 'catering-1');
        const onDemandOrder = data.orders.find((o: any) => o.id === 'ondemand-1');

        expect(cateringOrder.type).toBe('catering');
        expect(onDemandOrder.type).toBe('ondemand');
      });

      it('should sort combined orders by the specified field', async () => {
        (validateApiAuth as jest.Mock).mockResolvedValue({
          isValid: true,
          user: { id: 'user-123', type: 'CLIENT' },
        });

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'catering-1',
            orderNumber: 'CAT-001',
            createdAt: yesterday,
            orderTotal: 100,
            user: {},
            pickupAddress: {},
            deliveryAddress: {},
            dispatches: [],
            fileUploads: [],
          },
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([
          {
            id: 'ondemand-1',
            orderNumber: 'OD-001',
            createdAt: now,
            orderTotal: 50,
            user: {},
            pickupAddress: {},
            deliveryAddress: {},
            dispatches: [],
            fileUploads: [],
          },
        ]);

        const request = createGetRequest('http://localhost:3000/api/orders');

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        // Verify orders are sorted by createdAt desc (newest first)
        expect(data.orders[0].id).toBe('ondemand-1'); // Newer order first
        expect(data.orders[1].id).toBe('catering-1'); // Older order second
      });
    });
  });
});
