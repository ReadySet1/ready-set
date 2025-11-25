// src/__tests__/api/cater-valley/orders-update.test.ts

import { POST } from '@/app/api/cater-valley/orders/update/route';
import { prisma } from '@/lib/db/prisma';
import * as pricingService from '@/lib/services/pricingService';
import * as pricingHelper from '@/app/api/cater-valley/_lib/pricing-helper';
import { expectSuccessResponse, expectErrorResponse } from '@/__tests__/helpers/api-test-helpers';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    address: { findFirst: jest.fn(), create: jest.fn() },
    cateringRequest: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  },
}));

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

describe('POST /api/cater-valley/orders/update - Update Order', () => {
  const validUpdateData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    orderCode: 'TEST-001',
    deliveryDate: '2025-10-25',
    deliveryTime: '14:00',
    totalItem: 60,
    priceTotal: 850.00,
    pickupLocation: {
      name: 'Test Restaurant',
      address: '123 Pickup St',
      city: 'San Francisco',
      state: 'CA',
    },
    dropOffLocation: {
      name: 'Test Office',
      address: '456 Delivery Ave',
      city: 'San Francisco',
      state: 'CA',
      recipient: { name: 'John Doe', phone: '415-555-0200' },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CATERVALLEY_API_KEY = 'test-api-key';

    (pricingService.isDeliveryTimeAvailable as jest.Mock).mockReturnValue(true);
    (pricingService.calculatePickupTime as jest.Mock).mockReturnValue('2025-10-25T13:15:00Z');

    // Mock the new pricing helper (replaces calculateDeliveryPrice)
    (pricingHelper.calculateCaterValleyPricing as jest.Mock).mockResolvedValue({
      distance: 5.2,
      usedFallbackDistance: false,
      numberOfBridges: 0,
      pricingResult: {
        deliveryFee: 75.00,
        deliveryCost: 75.00,
        totalMileagePay: 0,
        dailyDriveDiscount: 0,
        bridgeToll: 0,
      },
    });

    (prisma.address.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.address.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'pickup-addr-1' })
      .mockResolvedValueOnce({ id: 'delivery-addr-1' });

    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
      id: validUpdateData.id,
      orderNumber: 'CV-TEST-001',
      status: 'ACTIVE',
      user: { email: 'system@catervalley.com' },
      pickupAddress: {},
      deliveryAddress: {},
    });

    (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.cateringRequest.update as jest.Mock).mockResolvedValue({
      id: validUpdateData.id,
      orderNumber: 'CV-TEST-001',
      pickupAddress: {},
      deliveryAddress: {},
      user: {},
    });
  });

  afterEach(() => {
    delete process.env.CATERVALLEY_API_KEY;
  });

  describe('✅ Successful Update', () => {
    it('should update order successfully', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      const data = await expectSuccessResponse(response, 200);

      expect(data.status).toBe('SUCCESS');
      expect(data.id).toBe(validUpdateData.id);
      expect(data.deliveryPrice).toBe(75.00);
      expect(data.totalPrice).toBe(925.00);
    });

    it('should recalculate pricing on update', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      await POST(request);

      expect(pricingHelper.calculateCaterValleyPricing).toHaveBeenCalledWith({
        orderCode: 'TEST-001',
        pickupLocation: validUpdateData.pickupLocation,
        dropOffLocation: validUpdateData.dropOffLocation,
        totalItem: 60,
        priceTotal: 850.00,
        feature: 'catervalley_webhook_update',
      });
    });
  });

  describe('🔐 Authentication', () => {
    it('should reject without proper authentication', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 401, /Unauthorized/i);
    });
  });

  describe('❌ Validation Errors', () => {
    it('should reject invalid UUID', async () => {
      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify({ ...validUpdateData, id: 'not-a-uuid' }),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 400, /Validation failed/i);
    });

    it('should reject missing fields', async () => {
      const invalidData = { ...validUpdateData };
      delete (invalidData as any).orderCode;

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
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
    it('should reject non-existent order', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 404, /Order not found/i);
    });

    it('should reject non-CaterValley orders', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: validUpdateData.id,
        orderNumber: 'REG-001',
        status: 'ACTIVE',
        user: { email: 'regular@user.com' },
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 403, /cannot be updated via CaterValley API/i);
    });

    it('should reject orders in non-updatable status', async () => {
      (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue({
        id: validUpdateData.id,
        orderNumber: 'CV-TEST-001',
        status: 'COMPLETED',
        user: { email: 'system@catervalley.com' },
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 422, /cannot be updated in current status/i);
    });

    it('should reject unavailable delivery time', async () => {
      (pricingService.isDeliveryTimeAvailable as jest.Mock).mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(validUpdateData),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 422, /Delivery time is not available/i);
    });

    it('should reject duplicate order code', async () => {
      // Update to a different order code that already exists
      const updateWithNewCode = {
        ...validUpdateData,
        orderCode: 'NEW-ORDER-CODE', // Different from the existing order's CV-TEST-001
      };

      // Mock that another order already has this code
      (prisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'different-id',
        orderNumber: 'CV-NEW-ORDER-CODE',
      });

      const request = new Request('http://localhost:3000/api/cater-valley/orders/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'partner': 'catervalley',
        },
        body: JSON.stringify(updateWithNewCode),
      });

      const response = await POST(request);
      await expectErrorResponse(response, 409, /already exists/i);
    });
  });
});
