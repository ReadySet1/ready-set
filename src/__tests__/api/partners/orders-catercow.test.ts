// src/__tests__/api/partners/orders-catercow.test.ts
//
// Verifies the canonical /api/partners/orders/draft endpoint accepts
// CaterCow's headers, applies the CC- prefix, and writes "CaterCow"
// as the brokerage label. This is the integration test the contract
// (docs/catercow/API_CONTRACT.md) maps to.

import { POST as draftPOST } from '@/app/api/partners/orders/draft/route';
import { prisma } from '@/lib/db/prisma';
import * as pricingService from '@/lib/services/pricingService';
import * as pricingHelper from '@/app/api/cater-valley/_lib/pricing-helper';
import { expectSuccessResponse, expectErrorResponse } from '@/__tests__/helpers/api-test-helpers';

jest.mock('@/lib/db/prisma', () => {
  const mockPrisma: any = {
    profile: { upsert: jest.fn() },
    address: { findFirst: jest.fn(), create: jest.fn() },
    cateringRequest: { findUnique: jest.fn(), create: jest.fn() },
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

// Registry mock returns the right partner for the (slug, key) tuple.
// CaterCow uses CC- prefix and "CaterCow" display name.
jest.mock('@/lib/services/partner-registry', () => ({
  authenticatePartner: jest.fn(async (req: Request) => {
    const slug = req.headers.get('partner');
    const apiKey = req.headers.get('x-api-key');
    if (!slug) return { ok: false, reason: 'missing_partner_header' };
    if (!apiKey) return { ok: false, reason: 'missing_api_key' };

    if (slug === 'catercow' && apiKey === 'cc-test-key') {
      return {
        ok: true,
        partner: {
          id: 'partner-cc-id',
          slug: 'catercow',
          displayName: 'CaterCow',
          orderPrefix: 'CC-',
          webhookUrl: null,
          webhookSecret: null,
          rateLimitPerMin: 100,
          isActive: true,
        },
      };
    }
    if (slug === 'catervalley' && apiKey === 'cv-test-key') {
      return {
        ok: true,
        partner: {
          id: 'partner-cv-id',
          slug: 'catervalley',
          displayName: 'CaterValley',
          orderPrefix: 'CV-',
          webhookUrl: null,
          webhookSecret: null,
          rateLimitPerMin: 100,
          isActive: true,
        },
      };
    }
    return { ok: false, reason: 'invalid_key' };
  }),
  getPartnerBySlug: jest.fn(),
  computeApiKeyHash: jest.fn((k: string) => `hash:${k}`),
  _resetPartnerCacheForTests: jest.fn(),
}));

const validOrderData = {
  orderCode: 'CC-12345',
  deliveryDate: '2026-06-15',
  deliveryTime: '11:30',
  totalItem: 30,
  priceTotal: 850.0,
  pickupLocation: {
    name: 'Tasty Catering Co.',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
    phone: '415-555-0100',
  },
  dropOffLocation: {
    name: 'Acme Corp HQ',
    address: '500 Market St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    instructions: 'Loading dock, ring bell #3',
    recipient: { name: 'Jane Smith', phone: '415-555-0200' },
  },
};

function buildPartnerDraftRequest(headers: Record<string, string>, body: unknown = validOrderData): Request {
  return new Request('http://localhost:3000/api/partners/orders/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/partners/orders/draft (CaterCow)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (pricingService.isDeliveryTimeAvailable as jest.Mock).mockReturnValue(true);
    (pricingService.calculatePickupTime as jest.Mock).mockReturnValue('2026-06-15T10:45:00Z');

    (pricingHelper.calculateCaterValleyPricing as jest.Mock).mockResolvedValue({
      distance: 1.8,
      usedFallbackDistance: false,
      numberOfBridges: 0,
      pricingResult: {
        deliveryFee: 62.5,
        deliveryCost: 62.5,
        totalMileagePay: 0,
        dailyDriveDiscount: 0,
        bridgeToll: 0,
      },
    });

    (prisma.profile.upsert as jest.Mock).mockResolvedValue({ id: 'cc-system-user', email: 'system@catercow.com' });
    (prisma.address.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.address.create as jest.Mock)
      .mockResolvedValueOnce({ id: 'cc-pickup-addr' })
      .mockResolvedValueOnce({ id: 'cc-delivery-addr' });
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.cateringRequest.create as jest.Mock).mockResolvedValue({
      id: 'cc-order-1',
      orderNumber: 'CC-12345',
      status: 'ACTIVE',
      brokerage: 'CaterCow',
      pickupAddress: validOrderData.pickupLocation,
      deliveryAddress: validOrderData.dropOffLocation,
      user: { id: 'cc-system-user', email: 'system@catercow.com' },
    });
  });

  it('accepts a CaterCow draft and uses the CC- prefix + CaterCow brokerage label', async () => {
    const response = await draftPOST(
      buildPartnerDraftRequest({ partner: 'catercow', 'x-api-key': 'cc-test-key' }) as any
    );
    const data = await expectSuccessResponse(response, 201);
    expect(data.status).toBe('SUCCESS');

    const createCall = (prisma.cateringRequest.create as jest.Mock).mock.calls[0][0];
    // orderCode "CC-12345" already starts with CC- so buildOrderNumber is
    // idempotent (no double prefix). This is the intended behavior so
    // partner retries that re-prefix don't end up with CC-CC-12345.
    expect(createCall.data.orderNumber).toBe('CC-12345');
    expect(createCall.data.brokerage).toBe('CaterCow');
    expect(createCall.data.guid).toMatch(/^catercow-/);
    expect(createCall.data.pickupNotes).toMatch(/^CaterCow Order/);

    const upsertCall = (prisma.profile.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertCall.where.email).toBe('system@catercow.com');
    expect(upsertCall.create.companyName).toBe('CaterCow');
  });

  it('rejects a CaterCow request that uses CaterValley\'s key', async () => {
    const response = await draftPOST(
      buildPartnerDraftRequest({ partner: 'catercow', 'x-api-key': 'cv-test-key' }) as any
    );
    await expectErrorResponse(response, 401, /Unauthorized/);
  });

  it('rejects a request with no api key', async () => {
    const response = await draftPOST(
      buildPartnerDraftRequest({ partner: 'catercow' }) as any
    );
    await expectErrorResponse(response, 401, /Unauthorized/);
  });

  it('routes a CaterValley request to the same handler with CV- prefix and CaterValley brokerage', async () => {
    const response = await draftPOST(
      buildPartnerDraftRequest({ partner: 'catervalley', 'x-api-key': 'cv-test-key' }, {
        ...validOrderData,
        orderCode: 'CV-99999',
      }) as any
    );
    await expectSuccessResponse(response, 201);
    const createCall = (prisma.cateringRequest.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.orderNumber).toBe('CV-99999');
    expect(createCall.data.brokerage).toBe('CaterValley');
  });
});
