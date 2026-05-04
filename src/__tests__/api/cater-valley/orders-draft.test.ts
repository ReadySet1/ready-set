// src/__tests__/api/cater-valley/orders-draft.test.ts

import { POST } from '@/app/api/cater-valley/orders/draft/route';
import { prisma } from '@/lib/db/prisma';
import * as pricingService from '@/lib/services/pricingService';
import * as pricingHelper from '@/app/api/cater-valley/_lib/pricing-helper';
import {
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies. `$transaction` invokes the callback with the same
// mock client so any `tx.foo.bar()` calls inside the route hit the same
// jest.fn instances as bare `prisma.foo.bar()` calls.
jest.mock('@/lib/db/prisma', () => {
  const mockPrisma: any = {
    profile: {
      upsert: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    cateringRequest: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };
  mockPrisma.$transaction = jest.fn((callback: (tx: any) => unknown) => callback(mockPrisma));
  return { prisma: mockPrisma };
});

jest.mock('@/lib/services/pricingService', () => ({
  calculatePickupTime: jest.fn(),
  isDeliveryTimeAvailable: jest.fn(),
}));

jest.mock('@/app/api/cater-valley/_lib/pricing-helper', () => ({
  calculateCaterValleyPricing: jest.fn(),
}));

jest.mock('@/lib/utils/timezone', () => ({
  localTimeToUtc: jest.fn((date: string, time: string) => `${date}T${time}:00Z`),
}));

describe('POST /api/cater-valley/orders/draft - Create Draft Order', () => {
  const validOrderData = {
    orderCode: 'TEST-001',
    deliveryDate: '2025-10-25',
    deliveryTime: '14:00',
    totalItem: 50,
    priceTotal: 750.00,
    pickupLocation: {
      name: 'Test Restaurant',
      address: '123 Pickup St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      phone: '415-555-0100',
    },
    dropOffLocation: {
      name: 'Test Office',
      address: '456 Delivery Ave',
      city: 'San Francisco',
      state: 'CA',
      zip: '94103',
      instructions: 'Leave at reception',
      recipient: {
        name: 'John Doe',
        phone: '415-555-0200',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CATERVALLEY_API_KEY = 'test-api-key';

    // Default mocks
    (pricingService.isDeliveryTimeAvailable as jest.Mock).mockReturnValue(true);
    (pricingService.calculatePickupTime as jest.Mock).mockReturnValue('2025-10-25T13:15:00Z');

    // Mock the new pricing helper (replaces calculateDeliveryPrice)
    (pricingHelper.calculateCaterValleyPricing as jest.Mock).mockResolvedValue({
      distance: 5.2,
      usedFallbackDistance: false,
      numberOfBridges: 0,
      pricingResult: {
        deliveryFee: 65.00,
        deliveryCost: 65.00,
        totalMileagePay: 0,
        dailyDriveDiscount: 0,
        bridgeToll: 0,
      },
    });

    (prisma.profile.upsert as jest.Mock).mockResolvedValue({
      id: 'system-user-1',
      email: 'system@catervalley.com',
    });

    (prisma.address.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.address.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'pickup-addr-1' })
      .mockResolvedValueOnce({ id: 'delivery-addr-1' });

    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
      id: 'order-1',
      orderNumber: 'CV-TEST-001',
      status: 'ACTIVE',
      pickupAddress: validOrderData.pickupLocation,
      deliveryAddress: validOrderData.dropOffLocation,
      user: { id: 'system-user-1' },
    });
  });

  afterEach(() => {
    delete process.env.CATERVALLEY_API_KEY;
  });

  describe('✅ Successful Order Creation', () => {
    it('should create a draft order with valid data', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);

      expect(data.status).toBe('SUCCESS');
      expect(data.id).toBe('order-1');
      expect(data.deliveryPrice).toBe(65.00);
      expect(data.totalPrice).toBe(815.00); // 750 + 65
      expect(data.estimatedPickupTime).toBe('2025-10-25T13:15:00Z');
      expect(data.breakdown).toBeDefined();
    });

    it('should create system user if not exists', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      await POST(request);

      expect(prisma.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'system@catervalley.com' },
          create: expect.objectContaining({
            email: 'system@catervalley.com',
            name: 'CaterValley System',
            type: 'CLIENT',
            companyName: 'CaterValley',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should create addresses if not existing', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      await POST(request);

      expect(prisma.address.create).toHaveBeenCalledTimes(2);
      expect(prisma.address.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            street1: '123 Pickup St',
            city: 'San Francisco',
            state: 'CA',
            zip: '94102',
          }),
        })
      );
    });

    it('should reuse existing addresses', async () => {
      (prisma.address.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing-pickup' })
        .mockResolvedValueOnce({ id: 'existing-delivery' });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      await POST(request);

      expect(prisma.address.create).not.toHaveBeenCalled();
    });

    it('should calculate delivery pricing correctly', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      await POST(request);

      expect(pricingHelper.calculateCaterValleyPricing).toHaveBeenCalledWith({
        orderCode: 'TEST-001',
        pickupLocation: validOrderData.pickupLocation,
        dropOffLocation: validOrderData.dropOffLocation,
        totalItem: 50,
        priceTotal: 750.00,
        feature: 'catervalley_webhook_draft',
      });
    });

    it('should include breakdown in response', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 201);

      expect(data.breakdown).toEqual({
        basePrice: 65.00,
        mileageFee: 0,
        dailyDriveDiscount: 0,
      });
    });
  });

  describe('🔐 Authentication', () => {
    it('should reject requests without partner header', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized.*Invalid API key or partner header/i);
    });

    it('should reject requests with wrong partner', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'wrong-partner',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });

    it('should reject requests with invalid API key', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'wrong-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });

    it('should reject requests without API key', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });
  });

  describe('❌ Validation Errors', () => {
    it('should reject invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: 'invalid json{',
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Invalid JSON/i);
    });

    it('should reject missing orderCode', async () => {
      const invalidData = { ...validOrderData };
      delete (invalidData as any).orderCode;

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });

    it('should reject invalid date format', async () => {
      const invalidData = { ...validOrderData, deliveryDate: '25-10-2025' };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed|Invalid date format/i);
    });

    it('should reject invalid time format', async () => {
      const invalidData = { ...validOrderData, deliveryTime: '2:00 PM' };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed|Invalid time format/i);
    });

    it('should reject negative item count', async () => {
      const invalidData = { ...validOrderData, totalItem: -5 };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });

    it('should reject missing pickup location', async () => {
      const invalidData = { ...validOrderData };
      delete (invalidData as any).pickupLocation;

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });

    it('should reject missing recipient information', async () => {
      const invalidData = {
        ...validOrderData,
        dropOffLocation: {
          ...validOrderData.dropOffLocation,
          recipient: {} as any,
        },
      };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(invalidData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });
  });

  describe('❌ Business Logic Errors', () => {
    it('should reject unavailable delivery time', async () => {
      (pricingService.isDeliveryTimeAvailable as jest.Mock).mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 422, /Delivery time is not available/i);
    });

    it('should reject duplicate order code', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-order',
        orderNumber: 'CV-TEST-001',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 409, /Order.*already exists/i);
    });

    it('should handle database errors gracefully', async () => {
      (prisma.cateringRequest.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 500, /Internal server error|failed to create draft order/i);
    });
  });

  describe('📊 Edge Cases', () => {
    it('should extract ZIP from address if not provided', async () => {
      const dataWithoutZip = {
        ...validOrderData,
        pickupLocation: {
          ...validOrderData.pickupLocation,
          address: '123 Pickup St, 94102',
        },
        dropOffLocation: {
          ...validOrderData.dropOffLocation,
          address: '456 Delivery Ave, 94103',
        },
      };
      delete (dataWithoutZip.pickupLocation as any).zip;
      delete (dataWithoutZip.dropOffLocation as any).zip;

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(dataWithoutZip),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 201);
    });

    it('should handle optional phone in pickup location', async () => {
      const dataWithoutPhone = {
        ...validOrderData,
        pickupLocation: {
          ...validOrderData.pickupLocation,
        },
      };
      delete (dataWithoutPhone.pickupLocation as any).phone;

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(dataWithoutPhone),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 201);
    });

    it('should handle optional metadata field', async () => {
      const dataWithMetadata = {
        ...validOrderData,
        metadata: {
          source: 'mobile-app',
          version: '2.0',
          customField: 'value',
        },
      };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(dataWithMetadata),
      });

      const response = await POST(request);
      await expectSuccessResponse(response, 201);
    });

    it('should prefix order number with CV-', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      await POST(request);

      expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'CV-TEST-001',
          }),
        })
      );
    });

    it('should not duplicate CV- prefix if already present', async () => {
      const dataWithCVPrefix = {
        ...validOrderData,
        orderCode: 'CV-TEST-002', // Already has CV- prefix
      };

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(dataWithCVPrefix),
      });

      await POST(request);

      // Should use CV-TEST-002, NOT CV-CV-TEST-002
      expect(prisma.cateringRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'CV-TEST-002', // Not duplicated
          }),
        })
      );
    });
  });

  describe('🔒 Phase 1 hardening', () => {
    it('rejects bodies above the 1MB limit with 413', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          partner: 'catervalley',
          'content-length': '2000000',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      expect(response.status).toBe(413);
      // Auth is checked AFTER body size; both should pass-through cleanly
      expect(prisma.cateringRequest.findUnique).not.toHaveBeenCalled();
    });

    it('treats a soft-deleted order as not-conflicting (allows reuse of orderCode)', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'old-order-id',
        deletedAt: new Date('2025-01-01'),
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          partner: 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      // Soft-deleted match must NOT block — still 201/SUCCESS path.
      expect(response.status).toBe(201);
      expect(prisma.cateringRequest.create).toHaveBeenCalled();
    });

    it('returns 409 when DB unique-violation races our fast-path check', async () => {
      // Fast-path says no existing order, but the DB raises P2002 at insert
      // (a concurrent partner request beat us between the find and create).
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const { Prisma } = await import('@prisma/client');
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the constraint: `cateringRequest_orderNumber_key`',
        { code: 'P2002', clientVersion: 'test' }
      );
      (prisma.cateringRequest.create as jest.Mock).mockRejectedValueOnce(p2002);

      const request = new Request('http://localhost:3000/api/cater-valley/orders/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          partner: 'catervalley',
        },
        body: JSON.stringify(validOrderData),
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.message).toMatch(/already exists/i);
    });

    it('replays a cached response on retry with the same Idempotency-Key', async () => {
      // Reset the in-memory Redis store so the cache is empty.
      const { _resetRedisClientForTests } = await import('@/lib/redis/client');
      _resetRedisClientForTests();
      const { _resetRateLimiterForTests } = await import('@/lib/security/rate-limit');
      _resetRateLimiterForTests();

      const buildRequest = () =>
        new Request('http://localhost:3000/api/cater-valley/orders/draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            partner: 'catervalley',
            'idempotency-key': 'partner-retry-uuid-1',
          },
          body: JSON.stringify({ ...validOrderData, orderCode: 'IDEMPOTENT-001' }),
        });

      const first = await POST(buildRequest());
      expect(first.status).toBe(201);

      // Second call with the same key should hit the cache and NOT touch
      // the DB again.
      const createCallCountAfterFirst = (prisma.cateringRequest.create as jest.Mock).mock.calls.length;
      const second = await POST(buildRequest());

      expect(second.status).toBe(201);
      expect(second.headers.get('x-idempotent-replay')).toBe('true');
      // Verify we did NOT issue another DB create for the replay.
      expect((prisma.cateringRequest.create as jest.Mock).mock.calls.length).toBe(
        createCallCountAfterFirst
      );
    });
  });
});
