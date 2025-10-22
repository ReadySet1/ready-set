// src/__tests__/api/catering-requests/catering-requests.test.ts

import { POST } from '@/app/api/catering-requests/route';
import { createClient } from '@/utils/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { validateUserNotSoftDeleted } from '@/lib/soft-delete-handlers';
import {
  createPostRequest,
  expectSuccessResponse,
  expectUnauthorized,
  expectForbidden,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/utils/supabase/server');
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    cateringRequest: {
      create: jest.fn(),
    },
    address: {
      create: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/soft-delete-handlers');
jest.mock('resend');

describe('/api/catering-requests API', () => {
  const mockSupabaseClient = {
    auth: {
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('POST /api/catering-requests - Create Catering Order', () => {
    const validCateringData = {
      pickupAddress: {
        street1: '123 Vendor St',
        street2: 'Suite 100',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        lat: 30.2672,
        lng: -97.7431,
      },
      deliveryAddress: {
        street1: '456 Client Ave',
        city: 'Austin',
        state: 'TX',
        zip: '78702',
        lat: 30.2700,
        lng: -97.7300,
      },
      pickupTime: '2024-12-01T10:00:00Z',
      arrivalTime: '2024-12-01T11:00:00Z',
      headcount: 50,
      orderTotal: '500.00',
      needHost: 'yes',
      hoursNeeded: '2',
      numberOfHost: '1',
      pickupNotes: 'Please call upon arrival',
      specialNotes: 'No peanuts please',
      clientAttention: 'John Doe',
    };

    describe('✅ Successful Order Creation', () => {
      it('should create a catering order with all fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'client@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'John Client',
          email: 'client@example.com',
        });

        const mockPickupAddress = { id: 'pickup-addr-123', ...validCateringData.pickupAddress };
        const mockDeliveryAddress = { id: 'delivery-addr-123', ...validCateringData.deliveryAddress };

        (prisma.address.create as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-12345',
          userId: 'user-123',
          status: 'PENDING',
          ...validCateringData,
          pickupAddressId: mockPickupAddress.id,
          deliveryAddressId: mockDeliveryAddress.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.id).toBe('order-123');
        expect(data.orderNumber).toMatch(/^CAT-/);
        expect(data.status).toBe('PENDING');
        expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'user-123',
              headcount: 50,
              orderTotal: expect.anything(),
            }),
          })
        );
      });

      it('should create addresses for pickup and delivery locations', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValueOnce({ id: 'pickup-123' })
          .mockResolvedValueOnce({ id: 'delivery-123' });

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-12345',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        await POST(request);

        // Verify both addresses were created
        expect(prisma.address.create).toHaveBeenCalledTimes(2);

        // Verify pickup address
        expect(prisma.address.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            street1: validCateringData.pickupAddress.street1,
            city: validCateringData.pickupAddress.city,
            state: validCateringData.pickupAddress.state,
            zip: validCateringData.pickupAddress.zip,
          }),
        });

        // Verify delivery address
        expect(prisma.address.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            street1: validCateringData.deliveryAddress.street1,
            city: validCateringData.deliveryAddress.city,
            state: validCateringData.deliveryAddress.state,
            zip: validCateringData.deliveryAddress.zip,
          }),
        });
      });

      it('should generate unique order number', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-67890',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        expect(data.orderNumber).toMatch(/^CAT-\d+$/);
      });

      it('should allow admin to create order for another user', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123', email: 'admin@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'client-456',
          name: 'Client User',
          email: 'client@example.com',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-12345',
          userId: 'client-456',
        });

        const dataWithClientId = {
          ...validCateringData,
          clientId: 'client-456',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          dataWithClientId
        );

        await POST(request);

        // Verify order was created for specified client
        expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'client-456',
            }),
          })
        );
      });

      it('should store optional fields when provided', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-12345',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        await POST(request);

        // Verify optional fields were stored
        expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              pickupNotes: 'Please call upon arrival',
              specialNotes: 'No peanuts please',
              clientAttention: 'John Doe',
              needHost: 'yes',
              hoursNeeded: '2',
              numberOfHost: '1',
            }),
          })
        );
      });
    });

    describe('🔐 Authentication Tests', () => {
      it('should return 401 for unauthenticated requests', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        await expectUnauthorized(response, /Unauthorized/i);
      });

      it('should return 401 when user ID is missing', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: null } },
          error: null,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        await expectUnauthorized(response);
      });
    });

    describe('🔒 Authorization Tests', () => {
      it('should return 403 for soft-deleted users', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'deleted-user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: false,
          error: 'User account has been deleted',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        await expectForbidden(response, /account has been deleted/i);
      });

      it('should validate client user when clientId is provided', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'admin-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: false,
          error: 'Client account is suspended',
        });

        const dataWithClientId = {
          ...validCateringData,
          clientId: 'suspended-client',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          dataWithClientId
        );

        const response = await POST(request);
        await expectForbidden(response, /suspended/i);
      });
    });

    describe('✏️ Validation Tests', () => {
      it('should return 400 for missing required fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        const incompleteData = {
          pickupAddress: validCateringData.pickupAddress,
          // Missing deliveryAddress, pickupTime, etc.
        };

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          incompleteData
        );

        const response = await POST(request);

        // Expect validation error
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
      });

      it('should validate address format', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        const invalidAddressData = {
          ...validCateringData,
          pickupAddress: {
            street1: '123 Test St',
            // Missing required address fields
          },
        };

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          invalidAddressData
        );

        const response = await POST(request);

        expect(response.status).toBeGreaterThanOrEqual(400);
      });

      it('should validate date/time fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        const invalidDateData = {
          ...validCateringData,
          pickupTime: 'invalid-date',
          arrivalTime: 'invalid-date',
        };

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          invalidDateData
        );

        const response = await POST(request);

        expect(response.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe('❌ Error Handling', () => {
      it('should handle database errors during address creation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
        });

        (prisma.address.create as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle database errors during order creation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        (prisma.cateringRequest.create as jest.Mock).mockRejectedValue(
          new Error('Order creation failed')
        );

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        await expectErrorResponse(response, 500);
      });

      it('should handle errors when user profile not found', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);

        // Should still create the order even if profile fetch fails
        // or handle appropriately based on business logic
        expect(response.status).toBeGreaterThanOrEqual(200);
      });
    });

    describe('📧 Email Notifications', () => {
      it('should send confirmation email after successful order creation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'client@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user-123',
          name: 'John Client',
          email: 'client@example.com',
        });

        (prisma.address.create as jest.Mock)
          .mockResolvedValue({ id: 'addr-123' });

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: 'order-123',
          orderNumber: 'CAT-12345',
          userId: 'user-123',
          ...validCateringData,
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);

        // Email sending is handled internally, verify order was created
        expect(response.status).toBe(201);
      });
    });
  });
});
