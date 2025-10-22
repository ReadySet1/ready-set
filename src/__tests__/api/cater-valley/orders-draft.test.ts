// src/__tests__/api/cater-valley/orders-draft.test.ts

import { POST } from '@/app/api/cater-valley/orders/draft/route';
import { prisma } from '@/lib/db/prisma';
import * as pricingService from '@/lib/services/pricingService';
import {
  createPostRequest,
  expectSuccessResponse,
  expectErrorResponse,
} from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
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
  },
}));

jest.mock('@/lib/services/pricingService', () => ({
  calculateDeliveryPrice: jest.fn(),
  calculatePickupTime: jest.fn(),
  isDeliveryTimeAvailable: jest.fn(),
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
    (pricingService.calculateDeliveryPrice as jest.Mock).mockResolvedValue({
      deliveryPrice: 65.00,
      distance: 5.2,
      tier: 'tier2',
      breakdown: {
        basePrice: 65.00,
        distanceTier: 'standard',
        headCountTier: 'tier2',
        foodCostTier: 'tier3',
        tipIncluded: true,
        calculation: 'Standard delivery',
      },
    });
    (pricingService.calculatePickupTime as jest.Mock).mockReturnValue('2025-10-25T13:15:00Z');

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

      expect(pricingService.calculateDeliveryPrice).toHaveBeenCalledWith({
        pickupAddress: '123 Pickup St, San Francisco, CA',
        dropoffAddress: '456 Delivery Ave, San Francisco, CA',
        headCount: 50,
        foodCost: 750.00,
        deliveryDate: '2025-10-25',
        deliveryTime: '14:00',
        includeTip: true,
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
        distanceTier: 'standard',
        headCountTier: 'tier2',
        foodCostTier: 'tier3',
        tipIncluded: true,
        calculation: 'Standard delivery',
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
  });
});
