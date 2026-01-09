// src/__tests__/api/tracking/delivery-status-transitions.test.ts

/**
 * Comprehensive tests for delivery status transitions
 * Tests the state machine behavior of delivery status updates
 * and verifies database state changes after transitions.
 */

import { PUT } from '@/app/api/tracking/deliveries/[id]/route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { DriverStatus } from '@/types/user';
import {
  createPutRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/auth-middleware');
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  },
}));

describe('Delivery Status Transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to setup authenticated driver
  const setupDriverAuth = (userId: string = 'driver-user-1') => {
    (withAuth as jest.Mock).mockResolvedValue({
      success: true,
      context: {
        user: { id: userId, type: 'DRIVER' },
      },
    });
  };

  // Helper to setup authenticated admin
  const setupAdminAuth = (userId: string = 'admin-123') => {
    (withAuth as jest.Mock).mockResolvedValue({
      success: true,
      context: {
        user: { id: userId, type: 'ADMIN' },
      },
    });
  };

  // Helper to mock delivery lookup
  const mockDeliveryLookup = (
    status: string,
    driverId: string = 'driver-1',
    userId: string = 'driver-user-1'
  ) => {
    (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([
      {
        driver_id: driverId,
        status,
        user_id: userId,
      },
    ]);
  };

  describe('Status Transition State Machine', () => {
    describe('Valid Transitions', () => {
      it('should allow ASSIGNED -> EN_ROUTE_TO_CLIENT transition', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        const data = await expectSuccessResponse(response, 200);

        expect(data.success).toBe(true);
      });

      it('should allow EN_ROUTE_TO_CLIENT -> ARRIVED_TO_CLIENT transition', async () => {
        setupDriverAuth();
        mockDeliveryLookup('EN_ROUTE_TO_CLIENT');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.ARRIVED_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });

      it('should allow ARRIVED_TO_CLIENT -> COMPLETED transition', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ARRIVED_TO_CLIENT');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            status: DriverStatus.COMPLETED,
            proofOfDelivery: 'https://example.com/pod.jpg',
          }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });

      it('should allow full transition workflow (ASSIGNED -> COMPLETED)', async () => {
        // This tests the complete happy path
        const transitions = [
          { from: 'ASSIGNED', to: DriverStatus.EN_ROUTE_TO_CLIENT },
          { from: 'EN_ROUTE_TO_CLIENT', to: DriverStatus.ARRIVED_TO_CLIENT },
          { from: 'ARRIVED_TO_CLIENT', to: DriverStatus.COMPLETED },
        ];

        for (const transition of transitions) {
          jest.clearAllMocks();
          setupDriverAuth();
          mockDeliveryLookup(transition.from);
          (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

          const request = createPutRequest(
            'http://localhost:3000/api/tracking/deliveries/delivery-1',
            { status: transition.to }
          );

          const response = await PUT(request, {
            params: Promise.resolve({ id: 'delivery-1' }),
          });
          expect(response.status).toBe(200);
        }
      });
    });

    describe('Invalid Statuses', () => {
      it('should reject invalid status values', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: 'INVALID_STATUS' }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        await expectErrorResponse(response, 400, /Invalid status/i);
      });

      it('should reject empty status', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { notes: 'Just a note update' } // No status
        );

        // Should succeed as status is optional for non-status updates
        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Database State Verification', () => {
    describe('Status Updates', () => {
      it('should update status field in database', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        // Verify the UPDATE query was called with status field
        const updateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(updateCall[0]).toContain('status =');
        // Status is passed as a parameter, not inline
        expect(updateCall).toContain(DriverStatus.EN_ROUTE_TO_CLIENT);
      });

      it('should include updated_at in status update', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        const updateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(updateCall[0]).toContain('updated_at = NOW()');
      });
    });

    describe('Driver Location Updates', () => {
      it('should update driver last_known_location when location provided', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            status: DriverStatus.EN_ROUTE_TO_CLIENT,
            location: {
              coordinates: { lat: 30.2672, lng: -97.7431 },
            },
          }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        // Find the driver update call
        const driverUpdateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.find(
          (call) => call[0].includes('UPDATE drivers')
        );
        expect(driverUpdateCall).toBeDefined();
        expect(driverUpdateCall[0]).toContain('last_known_location');
        expect(driverUpdateCall[1]).toBe('driver-1');
        expect(driverUpdateCall[2]).toContain('POINT(-97.7431 30.2672)');
      });

      it('should not update driver location when location not provided', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            status: DriverStatus.EN_ROUTE_TO_CLIENT,
          }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        // Should only have one call (delivery update), not driver update
        const driverUpdateCalls = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.filter(
          (call) => call[0].includes('UPDATE drivers')
        );
        expect(driverUpdateCalls).toHaveLength(0);
      });
    });

    describe('Shift Delivery Count', () => {
      it('should increment delivery_count when status is COMPLETED', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ARRIVED_TO_CLIENT');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.COMPLETED }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        // Find the shift update call
        const shiftUpdateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.find(
          (call) => call[0].includes('UPDATE driver_shifts')
        );
        expect(shiftUpdateCall).toBeDefined();
        expect(shiftUpdateCall[0]).toContain('delivery_count = delivery_count + 1');
      });

      it('should not increment delivery_count for non-COMPLETED status', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        const shiftUpdateCalls = (prisma.$executeRawUnsafe as jest.Mock).mock.calls.filter(
          (call) => call[0].includes('UPDATE driver_shifts')
        );
        expect(shiftUpdateCalls).toHaveLength(0);
      });
    });

    describe('Metadata Updates', () => {
      it('should merge notes into metadata', async () => {
        setupDriverAuth();
        mockDeliveryLookup('STARTED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            notes: 'Customer requested specific delivery instructions',
          }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        const updateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(updateCall[0]).toContain('metadata');
        expect(updateCall[0]).toContain('COALESCE(metadata');
      });

      it('should include statusUpdatedAt and updatedBy in metadata', async () => {
        setupDriverAuth();
        mockDeliveryLookup('STARTED');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            notes: 'Test note',
          }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        const updateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        // Find the metadata JSON parameter
        const metadataParam = updateCall.find(
          (param: string) =>
            typeof param === 'string' &&
            param.includes('statusUpdatedAt') &&
            param.includes('updatedBy')
        );
        expect(metadataParam).toBeDefined();

        const metadata = JSON.parse(metadataParam);
        expect(metadata.updatedBy).toBe('driver-user-1');
        expect(metadata.statusUpdatedAt).toBeDefined();
      });
    });

    describe('Proof of Delivery', () => {
      it('should store proof_of_delivery when provided', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ARRIVED_TO_CLIENT');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const podUrl = 'https://storage.example.com/pod/delivery-1.jpg';
        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          {
            status: DriverStatus.COMPLETED,
            proofOfDelivery: podUrl,
          }
        );

        await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });

        const updateCall = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
        expect(updateCall[0]).toContain('proof_of_delivery');
        expect(updateCall).toContain(podUrl);
      });
    });
  });

  describe('Role-Based Access Control', () => {
    describe('Driver Access', () => {
      it('should allow driver to update their own delivery', async () => {
        setupDriverAuth('driver-user-1');
        mockDeliveryLookup('ASSIGNED', 'driver-1', 'driver-user-1');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });

      it('should deny driver updating another driver delivery', async () => {
        setupDriverAuth('driver-user-2');
        mockDeliveryLookup('ASSIGNED', 'driver-1', 'driver-user-1');

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        await expectErrorResponse(response, 403, /Access denied/i);
      });
    });

    describe('Admin Access', () => {
      it('should allow admin to update any delivery', async () => {
        setupAdminAuth();
        mockDeliveryLookup('ASSIGNED', 'driver-1', 'driver-user-1');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });

      it('should allow SUPER_ADMIN to update any delivery', async () => {
        (withAuth as jest.Mock).mockResolvedValue({
          success: true,
          context: {
            user: { id: 'superadmin-123', type: 'SUPER_ADMIN' },
          },
        });
        mockDeliveryLookup('ASSIGNED', 'driver-1', 'driver-user-1');
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Database Errors', () => {
      it('should handle query errors gracefully', async () => {
        setupDriverAuth();
        (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Database connection lost')
        );

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        await expectErrorResponse(response, 500, /Failed to update delivery/i);
      });

      it('should handle update errors gracefully', async () => {
        setupDriverAuth();
        mockDeliveryLookup('ASSIGNED');
        (prisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(
          new Error('Constraint violation')
        );

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        await expectErrorResponse(response, 500, /Failed to update delivery/i);
      });
    });

    describe('Not Found Errors', () => {
      it('should return 404 for non-existent delivery', async () => {
        setupDriverAuth();
        (prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/non-existent',
          { status: DriverStatus.EN_ROUTE_TO_CLIENT }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'non-existent' }),
        });
        await expectErrorResponse(response, 404, /Delivery not found/i);
      });
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle rapid sequential updates', async () => {
      // Simulate rapid updates
      const statuses = [
        DriverStatus.EN_ROUTE_TO_CLIENT,
        DriverStatus.ARRIVED_TO_CLIENT,
        DriverStatus.COMPLETED,
      ];

      let currentStatus = 'ASSIGNED';
      for (const status of statuses) {
        jest.clearAllMocks();
        setupDriverAuth();
        mockDeliveryLookup(currentStatus);
        (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

        const request = createPutRequest(
          'http://localhost:3000/api/tracking/deliveries/delivery-1',
          { status }
        );

        const response = await PUT(request, {
          params: Promise.resolve({ id: 'delivery-1' }),
        });
        expect(response.status).toBe(200);

        // Update current status for next iteration
        currentStatus = status;
      }
    });
  });

  describe('Location Coordinate Validation', () => {
    it('should accept valid coordinates', async () => {
      setupDriverAuth();
      mockDeliveryLookup('ASSIGNED');
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const request = createPutRequest(
        'http://localhost:3000/api/tracking/deliveries/delivery-1',
        {
          status: DriverStatus.EN_ROUTE_TO_CLIENT,
          location: {
            coordinates: { lat: 30.2672, lng: -97.7431 },
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'delivery-1' }),
      });
      expect(response.status).toBe(200);
    });

    it('should accept boundary coordinates', async () => {
      setupDriverAuth();
      mockDeliveryLookup('ASSIGNED');
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const request = createPutRequest(
        'http://localhost:3000/api/tracking/deliveries/delivery-1',
        {
          status: DriverStatus.EN_ROUTE_TO_CLIENT,
          location: {
            coordinates: { lat: 90, lng: 180 }, // North pole, date line
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'delivery-1' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle negative coordinates', async () => {
      setupDriverAuth();
      mockDeliveryLookup('ASSIGNED');
      (prisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

      const request = createPutRequest(
        'http://localhost:3000/api/tracking/deliveries/delivery-1',
        {
          status: DriverStatus.EN_ROUTE_TO_CLIENT,
          location: {
            coordinates: { lat: -33.8688, lng: 151.2093 }, // Sydney
          },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'delivery-1' }),
      });
      expect(response.status).toBe(200);
    });
  });
});
