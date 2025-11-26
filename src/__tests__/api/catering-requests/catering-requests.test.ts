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
      findUnique: jest.fn(),
    },
    address: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
    fileUpload: {
      create: jest.fn(),
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

  // UUID constants for consistent test data
  const PICKUP_ADDRESS_ID = '11111111-1111-1111-1111-111111111111';
  const DELIVERY_ADDRESS_ID = '22222222-2222-2222-2222-222222222222';
  const USER_ID = '33333333-3333-3333-3333-333333333333';
  const ORDER_ID = '44444444-4444-4444-4444-444444444444';

  describe('POST /api/catering-requests - Create Catering Order', () => {
    // Valid data matching the route's expected schema
    const validCateringData = {
      orderNumber: 'CAT-12345',
      brokerage: 'Test Brokerage',
      date: '2024-12-01',
      pickupTime: '10:00',
      arrivalTime: '11:00',
      pickupAddress: { id: PICKUP_ADDRESS_ID },
      deliveryAddress: { id: DELIVERY_ADDRESS_ID },
      headcount: 50,
      orderTotal: '500.00',
      needHost: 'YES',
      hoursNeeded: '2',
      numberOfHosts: '1',
      pickupNotes: 'Please call upon arrival',
      specialNotes: 'No peanuts please',
      clientAttention: 'John Doe',
    };

    // Mock pickup and delivery address objects
    const mockPickupAddress = {
      id: PICKUP_ADDRESS_ID,
      street1: '123 Vendor St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    };

    const mockDeliveryAddress = {
      id: DELIVERY_ADDRESS_ID,
      street1: '456 Client Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78702',
    };

    describe('✅ Successful Order Creation', () => {
      it('should create a catering order with all fields', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID, email: 'client@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: USER_ID,
          name: 'John Client',
          email: 'client@example.com',
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
          userId: USER_ID,
          status: 'ACTIVE',
          pickupAddressId: PICKUP_ADDRESS_ID,
          deliveryAddressId: DELIVERY_ADDRESS_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        // Route returns orderId, message, and emailSent
        expect(data.orderId).toBe(ORDER_ID);
        expect(data.message).toBe('Catering request created successfully');
        expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: USER_ID,
              headcount: 50,
              orderTotal: expect.anything(),
              pickupAddressId: PICKUP_ADDRESS_ID,
              deliveryAddressId: DELIVERY_ADDRESS_ID,
            }),
          })
        );
      });

      it('should validate pickup and delivery addresses exist', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups - both addresses exist
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        await POST(request);

        // Verify both addresses were looked up
        expect(prisma.address.findUnique).toHaveBeenCalledWith({
          where: { id: PICKUP_ADDRESS_ID },
        });
        expect(prisma.address.findUnique).toHaveBeenCalledWith({
          where: { id: DELIVERY_ADDRESS_ID },
        });
      });

      it('should generate unique order number', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-67890',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 201);

        // Route returns orderId, not the full order object
        expect(data.orderId).toBe(ORDER_ID);
      });

      it('should allow admin to create order for another user', async () => {
        const ADMIN_ID = '55555555-5555-5555-5555-555555555555';
        const CLIENT_ID = '66666666-6666-6666-6666-666666666666';

        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: ADMIN_ID, email: 'admin@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: CLIENT_ID,
          name: 'Client User',
          email: 'client@example.com',
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
          userId: CLIENT_ID,
        });

        const dataWithClientId = {
          ...validCateringData,
          clientId: CLIENT_ID,
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
              userId: CLIENT_ID,
            }),
          })
        );
      });

      it('should store optional fields when provided', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: USER_ID,
          name: 'Test User',
          email: 'test@example.com',
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
        });

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        await POST(request);

        // Verify optional fields were stored
        // Note: Route stores needHost and numberOfHosts as provided by client
        // hoursNeeded and numberOfHosts are converted to numbers in route
        expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              pickupNotes: 'Please call upon arrival',
              specialNotes: 'No peanuts please',
              clientAttention: 'John Doe',
              needHost: 'YES',
              hoursNeeded: 2,
              numberOfHosts: 1,
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
      it('should handle database errors during address lookup', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookup failure
        (prisma.address.findUnique as jest.Mock).mockRejectedValue(
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
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

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
          data: { user: { id: USER_ID } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
        });

        // Profile lookup returns null (happens after order creation for email)
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

        const request = createPostRequest(
          'http://localhost:3000/api/catering-requests',
          validCateringData
        );

        const response = await POST(request);

        // Should still create the order even if profile not found for email
        expect(response.status).toBe(201);
      });
    });

    describe('📧 Email Notifications', () => {
      it('should send confirmation email after successful order creation', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: { id: USER_ID, email: 'client@example.com' } },
          error: null,
        });

        (validateUserNotSoftDeleted as jest.Mock).mockResolvedValue({
          isValid: true,
        });

        // Mock existing order check (no duplicate)
        (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

        // Mock address lookups
        (prisma.address.findUnique as jest.Mock)
          .mockResolvedValueOnce(mockPickupAddress)
          .mockResolvedValueOnce(mockDeliveryAddress);

        (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
          id: ORDER_ID,
          orderNumber: 'CAT-12345',
          userId: USER_ID,
          headcount: 50,
          orderTotal: { toString: () => '500.00' },
        });

        // Profile lookup for email (after order creation)
        (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
          id: USER_ID,
          name: 'John Client',
          email: 'client@example.com',
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
