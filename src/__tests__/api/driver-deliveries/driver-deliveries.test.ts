// src/__tests__/api/driver-deliveries/driver-deliveries.test.ts

import { GET } from '@/app/api/driver-deliveries/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/utils/prismaDB';
import { CONSTANTS } from '@/constants';
import {
  createGetRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Helper to extract deliveries from new response format
const getDeliveries = (data: any): any[] => {
  if (data && typeof data === 'object' && 'deliveries' in data) {
    return data.deliveries;
  }
  return Array.isArray(data) ? data : [];
};

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    dispatch: {
      findMany: jest.fn(),
    },
    cateringRequest: {
      findMany: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn(),
    },
    address: {
      findMany: jest.fn(),
    },
  },
}));

describe('/api/driver-deliveries API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('GET /api/driver-deliveries - Driver Deliveries List', () => {
    describe('✅ Successful Retrieval', () => {
      it('should return combined catering and on-demand deliveries', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: 'catering-1', onDemandId: null },
          { cateringRequestId: null, onDemandId: 'ondemand-1' },
        ];

        const mockCateringDelivery = {
          id: 'catering-1',
          pickupAddressId: 'pickup-1',
          deliveryAddressId: 'delivery-1',
          pickupTime: new Date('2024-12-01T10:00:00Z'),
          arrivalTime: new Date('2024-12-01T11:00:00Z'),
          createdAt: new Date('2024-12-01T08:00:00Z'),
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: {
            id: 'pickup-1',
            street1: '123 Vendor St',
            city: 'Austin',
          },
          deliveryAddress: {
            id: 'delivery-1',
            street1: '456 Client Ave',
            city: 'Austin',
          },
        };

        const mockOnDemandDelivery = {
          id: 'ondemand-1',
          pickupAddressId: 'pickup-2',
          deliveryAddressId: 'delivery-2',
          pickupTime: new Date('2024-12-01T12:00:00Z'),
          createdAt: new Date('2024-12-01T09:00:00Z'),
          user: { name: 'Jane Smith', email: 'jane@example.com' },
          pickupAddress: {
            id: 'pickup-2',
            street1: '789 Store Rd',
            city: 'Austin',
          },
          deliveryAddress: {
            id: 'delivery-2',
            street1: '321 Home Ln',
            city: 'Austin',
          },
        };

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          mockCateringDelivery,
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([
          mockOnDemandDelivery,
        ]);
        (prisma.address.findMany as jest.Mock).mockResolvedValue([
          mockOnDemandDelivery.deliveryAddress,
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        expect(deliveries).toHaveLength(2);
        const cateringDelivery = deliveries.find(
          (d: any) => d.delivery_type === 'catering'
        );
        const onDemandDelivery = deliveries.find(
          (d: any) => d.delivery_type === 'on_demand'
        );

        expect(cateringDelivery).toBeDefined();
        expect(cateringDelivery.id).toBe('catering-1');
        expect(cateringDelivery.user.name).toBe('John Doe');

        expect(onDemandDelivery).toBeDefined();
        expect(onDemandDelivery.id).toBe('ondemand-1');
        expect(onDemandDelivery.user.name).toBe('Jane Smith');
      });

      it('should support pagination parameters', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = Array.from({ length: 25 }, (_, i) => ({
          cateringRequestId: `catering-${i}`,
          onDemandId: null,
        }));

        const mockCateringDeliveries = Array.from({ length: 25 }, (_, i) => ({
          id: `catering-${i}`,
          createdAt: new Date(Date.now() - i * 1000000),
          user: { name: `User ${i}`, email: `user${i}@example.com` },
          pickupAddress: { street1: `Street ${i}`, city: 'Austin' },
          deliveryAddress: { street1: `Street ${i}`, city: 'Austin' },
        }));

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(
          mockCateringDeliveries
        );
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.address.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries?page=2&limit=5'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        // Should return items 5-9 (page 2, limit 5)
        expect(deliveries).toHaveLength(5);
      });

      it('should default to page 1 and limit 10', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        expect(Array.isArray(deliveries)).toBe(true);
      });

      it('should return empty deliveries array when driver has no dispatches', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await response.json();
        const deliveries = getDeliveries(data);

        expect(response.status).toBe(200);
        expect(deliveries).toEqual([]);
        expect(prisma.cateringRequest.findMany).not.toHaveBeenCalled();
        expect(prisma.onDemand.findMany).not.toHaveBeenCalled();
      });

      it('should sort deliveries by createdAt in descending order', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const now = Date.now();

        const mockDispatches = [
          { cateringRequestId: 'catering-1', onDemandId: null },
          { cateringRequestId: 'catering-2', onDemandId: null },
          { cateringRequestId: null, onDemandId: 'ondemand-1' },
        ];

        const mockCateringDeliveries = [
          {
            id: 'catering-1',
            createdAt: new Date(now - 2000000), // Older
            user: { name: 'User 1', email: 'user1@example.com' },
            pickupAddress: { street1: 'Street 1', city: 'Austin' },
            deliveryAddress: { street1: 'Street 1', city: 'Austin' },
          },
          {
            id: 'catering-2',
            createdAt: new Date(now - 1000000), // Newer
            user: { name: 'User 2', email: 'user2@example.com' },
            pickupAddress: { street1: 'Street 2', city: 'Austin' },
            deliveryAddress: { street1: 'Street 2', city: 'Austin' },
          },
        ];

        const mockOnDemandDeliveries = [
          {
            id: 'ondemand-1',
            createdAt: new Date(now), // Newest
            user: { name: 'User 3', email: 'user3@example.com' },
            pickupAddress: { street1: 'Street 3', city: 'Austin' },
            deliveryAddressId: 'delivery-3',
          },
        ];

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue(
          mockCateringDeliveries
        );
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue(
          mockOnDemandDeliveries
        );
        (prisma.address.findMany as jest.Mock).mockResolvedValue([
          { id: 'delivery-3', street1: 'Street 3', city: 'Austin' },
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        expect(deliveries).toHaveLength(3);
        expect(deliveries[0].id).toBe('ondemand-1'); // Newest
        expect(deliveries[1].id).toBe('catering-2');
        expect(deliveries[2].id).toBe('catering-1'); // Oldest
      });

      it('should handle BigInt serialization', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: 'catering-1', onDemandId: null },
        ];

        const mockCateringDelivery = {
          id: 'catering-1',
          someNumberField: BigInt(9007199254740991),
          createdAt: new Date(),
          user: { name: 'User', email: 'user@example.com' },
          pickupAddress: { street1: 'Street', city: 'Austin' },
          deliveryAddress: { street1: 'Street', city: 'Austin' },
        };

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          mockCateringDelivery,
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        expect(response.status).toBe(200);

        const data = await response.json();
        const deliveries = getDeliveries(data);
        expect(typeof deliveries[0].someNumberField).toBe('string');
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        });

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });

      it('should return 401 when user ID is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: null } },
          error: null,
        });

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        await expectUnauthorized(response);
      });
    });

    describe('📊 Data Aggregation', () => {
      it('should correctly map catering delivery addresses', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: 'catering-1', onDemandId: null },
        ];

        const mockCateringDelivery = {
          id: 'catering-1',
          createdAt: new Date(),
          user: { name: 'John Doe', email: 'john@example.com' },
          pickupAddress: {
            id: 'pickup-1',
            street1: '123 Vendor St',
            street2: 'Suite 100',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
          },
          deliveryAddress: {
            id: 'delivery-1',
            street1: '456 Client Ave',
            street2: null,
            city: 'Austin',
            state: 'TX',
            zipCode: '78702',
          },
        };

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          mockCateringDelivery,
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        expect(deliveries[0].delivery_type).toBe('catering');
        expect(deliveries[0].address.street1).toBe('123 Vendor St');
        expect(deliveries[0].delivery_address.street1).toBe('456 Client Ave');
      });

      it('should correctly map on-demand delivery addresses', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: null, onDemandId: 'ondemand-1' },
        ];

        const mockOnDemandDelivery = {
          id: 'ondemand-1',
          deliveryAddressId: 'delivery-addr-1',
          createdAt: new Date(),
          user: { name: 'Jane Smith', email: 'jane@example.com' },
          pickupAddress: {
            id: 'pickup-2',
            street1: '789 Store Rd',
            city: 'Austin',
          },
        };

        const mockDeliveryAddress = {
          id: 'delivery-addr-1',
          street1: '321 Home Ln',
          city: 'Austin',
        };

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(
          mockDispatches
        );
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([
          mockOnDemandDelivery,
        ]);
        (prisma.address.findMany as jest.Mock).mockResolvedValue([
          mockDeliveryAddress,
        ]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);
        const deliveries = getDeliveries(data);

        expect(deliveries[0].delivery_type).toBe('on_demand');
        expect(deliveries[0].address.street1).toBe('789 Store Rd');
        expect(deliveries[0].delivery_address.street1).toBe('321 Home Ln');
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle errors from dispatch query', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        await expectErrorResponse(
          response,
          500,
          /Error fetching driver deliveries/i
        );
      });

      it('should handle errors from catering request query', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue([
          { cateringRequestId: 'catering-1', onDemandId: null },
        ]);
        (prisma.cateringRequest.findMany as jest.Mock).mockRejectedValue(
          new Error('Query failed')
        );

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        await expectErrorResponse(response, 500);
      });
    });

    describe('📅 Historical Data Filtering', () => {
      it('should apply date filtering to catering queries', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: 'catering-1', onDemandId: null },
        ];

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(mockDispatches);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        await GET(request);

        // Verify the query includes date filtering with OR clause
        const cateringCall = (prisma.cateringRequest.findMany as jest.Mock).mock.calls[0][0];
        expect(cateringCall.where).toHaveProperty('OR');
        expect(cateringCall.where.OR).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ completeDateTime: null }),
            expect.objectContaining({ createdAt: expect.any(Object) }),
          ])
        );
      });

      it('should apply date filtering to on-demand queries', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: null, onDemandId: 'ondemand-1' },
        ];

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(mockDispatches);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.address.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        await GET(request);

        // Verify the query includes date filtering with OR clause
        const onDemandCall = (prisma.onDemand.findMany as jest.Mock).mock.calls[0][0];
        expect(onDemandCall.where).toHaveProperty('OR');
        expect(onDemandCall.where.OR).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ completeDateTime: null }),
            expect.objectContaining({ createdAt: expect.any(Object) }),
          ])
        );
      });

      it('should return metadata with historical days limit', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(data).toHaveProperty('metadata');
        expect(data.metadata).toHaveProperty('historicalDaysLimit');
        expect(data.metadata.historicalDaysLimit).toBe(CONSTANTS.DRIVER_HISTORICAL_DAYS_LIMIT);
        expect(data.metadata).toHaveProperty('cutoffDate');
      });

      it('should accept custom historicalDays parameter', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries?historicalDays=7'
        );

        const response = await GET(request);
        const data = await response.json();

        expect(data.metadata.historicalDaysLimit).toBe(7);
      });

      it('should include incomplete deliveries regardless of age', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'driver-123' } },
          error: null,
        });

        const mockDispatches = [
          { cateringRequestId: 'catering-old', onDemandId: null },
        ];

        // Old but incomplete delivery (60 days ago)
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const mockOldIncompleteDelivery = {
          id: 'catering-old',
          createdAt: sixtyDaysAgo,
          completeDateTime: null, // Not completed - should be included
          user: { name: 'User', email: 'user@example.com' },
          pickupAddress: { street1: 'Street', city: 'Austin' },
          deliveryAddress: { street1: 'Street', city: 'Austin' },
        };

        (prisma.dispatch.findMany as jest.Mock).mockResolvedValue(mockDispatches);
        (prisma.cateringRequest.findMany as jest.Mock).mockResolvedValue([
          mockOldIncompleteDelivery,
        ]);
        (prisma.onDemand.findMany as jest.Mock).mockResolvedValue([]);

        const request = createGetRequest(
          'http://localhost:3000/api/driver-deliveries'
        );

        const response = await GET(request);
        const data = await response.json();
        const deliveries = getDeliveries(data);

        // Old but incomplete delivery should be included due to OR clause
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].id).toBe('catering-old');
      });
    });
  });
});
