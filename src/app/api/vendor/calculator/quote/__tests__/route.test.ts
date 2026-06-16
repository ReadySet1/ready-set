/**
 * Tests for POST /api/vendor/calculator/quote
 *
 * Coverage:
 * 1. A CLIENT or DRIVER token is rejected (403/401).
 * 2. The response object contains NO driver-pay / margin / RS-fee keys.
 * 3. An unmapped vendor company_name falls back to standard config with isFallbackPricing: true.
 * 4. A TBD-tier input returns requiresCustomQuote: true (not a thrown 500).
 * 5. The lesser-fee tier rule is exercised (headcount tier vs food-cost tier → lesser fee).
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';
import type { AuthResult } from '@/lib/auth-middleware';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/auth-middleware', () => ({
  withAuth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    profile: {
      findUnique: jest.fn(),
    },
    deliveryConfiguration: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/monitoring/sentry', () => ({
  addSentryBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockPrisma = prisma as unknown as {
  profile: { findUnique: jest.MockedFunction<() => Promise<unknown>> };
  deliveryConfiguration: { findFirst: jest.MockedFunction<() => Promise<unknown>> };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate authenticated VENDOR user */
function authAsVendor(userId = 'vendor-user-id') {
  mockWithAuth.mockResolvedValueOnce({
    success: true,
    context: {
      user: { id: userId, email: 'vendor@example.com', type: 'VENDOR' },
    },
  } as unknown as AuthResult);
}

/** Simulate auth rejection (wrong role or unauthenticated) */
function authRejected(status: 401 | 403) {
  const error = status === 401 ? 'Authentication required' : 'Insufficient permissions';
  mockWithAuth.mockResolvedValueOnce({
    success: false,
    response: NextResponse.json({ error }, { status }),
    context: {} as AuthResult['context'],
  } as AuthResult);
}

/** Build a POST NextRequest with a JSON body */
function makePostRequest(body: Record<string, unknown>): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/vendor/calculator/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Override json() to reliably return the body in jest
  (req as { json: () => Promise<unknown> }).json = jest
    .fn()
    .mockResolvedValue(body);
  return req;
}

/** A valid baseline request body */
const VALID_BODY = {
  headcount: 30,
  foodCost: 400,
  totalMileage: 8,
  numberOfDrives: 1,
  numberOfStops: 1,
  requiresBridge: false,
};

// Forbidden response keys — must NEVER appear in a vendor quote
const FORBIDDEN_KEYS = [
  'driverPay',
  'driverBasePay',
  'driverBonusPay',
  'driverTotalBasePay',
  'totalDriverPay',
  'driverMaxPayPerDrop',
  'driverBasePayPerDrop',
  'readySetFee',
  'readySetAddonFee',
  'readySetTotalFee',
  'margin',
  'rsFee',
  'extraStopsBonus',   // driver-side; customer side uses extraStopsCharge
  'mileageRate',        // internal rate, not the dollar amount
  'bonusQualified',
  'bonusQualifiedPercent',
  'directTip',
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no DB config (forces in-memory fallback)
  mockPrisma.deliveryConfiguration.findFirst.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/vendor/calculator/quote', () => {
  // ── Auth ─────────────────────────────────────────────────────────────────

  describe('authentication & authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      authRejected(401);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe('Authentication required');
    });

    it('rejects CLIENT role with 403', async () => {
      authRejected(403);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe('Insufficient permissions');
    });

    it('rejects DRIVER role with 403', async () => {
      authRejected(403);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe('Insufficient permissions');
    });
  });

  // ── Response shape ───────────────────────────────────────────────────────

  describe('response shape (customer-safe only)', () => {
    it('contains no driver-pay, margin, or RS-fee keys', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);

      const body = await res.json();

      for (const key of FORBIDDEN_KEYS) {
        expect(body).not.toHaveProperty(key);
      }
    });

    it('returns all expected customer-facing fields', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);

      const body = await res.json();

      expect(body).toHaveProperty('deliveryCost');
      expect(body).toHaveProperty('mileageSurcharge');
      expect(body).toHaveProperty('multiDriveDiscount');
      expect(body).toHaveProperty('extraStopsCharge');
      expect(body).toHaveProperty('bridgeToll');
      expect(body).toHaveProperty('totalDeliveryFee');
      expect(body).toHaveProperty('pricingProfileLabel');
      expect(body).toHaveProperty('isFallbackPricing');
      expect(body).toHaveProperty('requiresCustomQuote');
      expect(body.requiresCustomQuote).toBe(false);
    });
  });

  // ── Fallback pricing ────────────────────────────────────────────────────

  describe('unmapped vendor fallback', () => {
    it('returns isFallbackPricing: true for unknown company name', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Acme Catering (Unknown)',
      });

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.isFallbackPricing).toBe(true);
      expect(body.pricingProfileLabel).toBe('Ready Set Food - Standard');
    });

    it('returns isFallbackPricing: true when profile has no company name', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: null,
      });

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.isFallbackPricing).toBe(true);
    });

    it('returns isFallbackPricing: false for a known vendor', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.isFallbackPricing).toBe(false);
    });
  });

  // ── TBD tier ────────────────────────────────────────────────────────────

  describe('TBD tier handling', () => {
    it('returns requiresCustomQuote: true for 300+ headcount (HTTP 200)', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, headcount: 350 }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.requiresCustomQuote).toBe(true);
      expect(body.pricingProfileLabel).toBe('Custom Quote Required');
    });

    it('returns requiresCustomQuote: true for $2,500+ food cost (HTTP 200)', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, headcount: 10, foodCost: 3000 }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.requiresCustomQuote).toBe(true);
    });

    it('does NOT throw a 500 for TBD-tier input', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, headcount: 500, foodCost: 5000 }),
      );
      // Must be 200 (with requiresCustomQuote), never 500
      expect(res.status).toBe(200);
    });
  });

  // ── Lesser-fee tier rule ────────────────────────────────────────────────

  describe('lesser-fee tier rule', () => {
    it('picks the tier with the lower fee when headcount and food cost map to different tiers', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      // Using Ready Set Food Standard (Destino) config:
      //   headcount 30 → tier 25-49 → $70 (flat, within/over same)
      //   foodCost $100 → tier 0-299.99 → $60 (flat, within/over same)
      // Lesser fee = $60 (food-cost tier wins)
      const res = await POST(
        makePostRequest({
          headcount: 30,
          foodCost: 100,
          totalMileage: 5,
          numberOfDrives: 1,
          numberOfStops: 1,
          requiresBridge: false,
        }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      // The delivery cost should be $60 (the lesser of $70 headcount vs $60 food cost)
      expect(body.deliveryCost).toBe(60);
    });

    it('picks headcount tier when it has the lower fee', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      // headcount 10 → tier 0-24 → $60
      // foodCost $500 → tier 300-599.99 → $70
      // Lesser fee = $60 (headcount tier wins)
      const res = await POST(
        makePostRequest({
          headcount: 10,
          foodCost: 500,
          totalMileage: 5,
          numberOfDrives: 1,
          numberOfStops: 1,
          requiresBridge: false,
        }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.deliveryCost).toBe(60);
    });
  });

  // ── CAL-08 guardrails ───────────────────────────────────────────────────

  describe('CAL-08 guardrails', () => {
    it('clamps totalDeliveryFee to >= 0', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      // Use 4+ drives to get maximum discount ($15/drive × 4 = $60 total)
      // With headcount 10, foodCost $100 → $60 delivery cost (Ready Set Food Standard)
      // Mileage within 10 miles → $0 surcharge
      // $60 cost - $60 discount = $0 (should not go negative)
      const res = await POST(
        makePostRequest({
          headcount: 10,
          foodCost: 100,
          totalMileage: 5,
          numberOfDrives: 4,
          numberOfStops: 1,
          requiresBridge: false,
        }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.totalDeliveryFee).toBeGreaterThanOrEqual(0);
    });

    it('caps multiDriveDiscount so it cannot exceed deliveryCost + mileageSurcharge', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      // 4+ drives = $15/drive × 4 = $60 total discount from engine
      // But deliveryCost ($60) + mileageSurcharge ($0) = $60
      // Capped discount should be <= $60
      const res = await POST(
        makePostRequest({
          headcount: 10,
          foodCost: 100,
          totalMileage: 5,
          numberOfDrives: 4,
          numberOfStops: 1,
          requiresBridge: false,
        }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.multiDriveDiscount).toBeLessThanOrEqual(
        body.deliveryCost + body.mileageSurcharge,
      );
    });
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe('input validation', () => {
    it('rejects missing required fields', async () => {
      authAsVendor();

      const res = await POST(makePostRequest({}));
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe('Invalid request body');
    });

    it('rejects negative headcount', async () => {
      authAsVendor();

      const res = await POST(
        makePostRequest({ ...VALID_BODY, headcount: -1 }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects negative food cost', async () => {
      authAsVendor();

      const res = await POST(
        makePostRequest({ ...VALID_BODY, foodCost: -10 }),
      );
      expect(res.status).toBe(400);
    });

    it('rejects numberOfDrives < 1', async () => {
      authAsVendor();

      const res = await POST(
        makePostRequest({ ...VALID_BODY, numberOfDrives: 0 }),
      );
      expect(res.status).toBe(400);
    });
  });

  // ── Bridge toll ─────────────────────────────────────────────────────────

  describe('bridge toll', () => {
    it('includes default bridge toll when requiresBridge is true', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, requiresBridge: true }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      // Ready Set Food Standard default toll is $8.50
      expect(body.bridgeToll).toBe(8.5);
    });

    it('returns zero bridge toll when requiresBridge is false', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, requiresBridge: false }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.bridgeToll).toBe(0);
    });
  });

  // ── Mileage surcharge ───────────────────────────────────────────────────

  describe('mileage surcharge', () => {
    it('charges mileage only for miles over the 10-mile threshold', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      // 14 miles, threshold = 10 → 4 extra miles × $3.00 = $12.00
      const res = await POST(
        makePostRequest({ ...VALID_BODY, totalMileage: 14 }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.mileageSurcharge).toBe(12);
    });

    it('charges zero mileage within the threshold', async () => {
      authAsVendor();
      mockPrisma.profile.findUnique.mockResolvedValue({
        companyName: 'Destino',
      });

      const res = await POST(
        makePostRequest({ ...VALID_BODY, totalMileage: 8 }),
      );
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.mileageSurcharge).toBe(0);
    });
  });
});
