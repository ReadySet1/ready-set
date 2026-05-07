// src/__tests__/lib/services/partner-registry.test.ts

import { NextRequest } from 'next/server';

import {
  authenticatePartner,
  computeApiKeyHash,
  getPartnerBySlug,
  _resetPartnerCacheForTests,
} from '@/lib/services/partner-registry';

const findFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    apiPartner: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
  },
}));

const VALID_KEY = 'a'.repeat(64); // 64-hex-ish placeholder
const VALID_KEY_HASH = computeApiKeyHash(VALID_KEY);

const CATERVALLEY_ROW = {
  id: 'cv-id',
  slug: 'catervalley',
  displayName: 'CaterValley',
  orderPrefix: 'CV-',
  apiKeyHash: VALID_KEY_HASH,
  apiKeyLastFour: VALID_KEY.slice(-4),
  webhookUrl: 'https://api.catervalley.com/webhook',
  webhookSecret: 'cv-webhook-secret',
  rateLimitPerMin: 100,
  isActive: true,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  deletedBy: null,
};

function buildRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/partners/orders/draft', {
    method: 'POST',
    headers,
  });
}

describe('partner-registry', () => {
  beforeEach(() => {
    findFirst.mockReset();
    _resetPartnerCacheForTests();
  });

  describe('authenticatePartner', () => {
    it('rejects when partner header is missing', async () => {
      const result = await authenticatePartner(
        buildRequest({ 'x-api-key': VALID_KEY })
      );
      expect(result).toEqual({ ok: false, reason: 'missing_partner_header' });
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('rejects when api key header is missing', async () => {
      const result = await authenticatePartner(
        buildRequest({ partner: 'catervalley' })
      );
      expect(result).toEqual({ ok: false, reason: 'missing_api_key' });
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('rejects with invalid_key when no partner row matches the hash', async () => {
      findFirst.mockResolvedValue(null);
      const result = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(result).toEqual({ ok: false, reason: 'invalid_key' });
    });

    it('rejects with unknown_partner when key is valid but slug header mismatches the row', async () => {
      findFirst.mockResolvedValue(CATERVALLEY_ROW);
      const result = await authenticatePartner(
        buildRequest({ partner: 'catercow', 'x-api-key': VALID_KEY })
      );
      expect(result).toEqual({ ok: false, reason: 'unknown_partner' });
    });

    it('rejects with inactive when partner row is is_active=false', async () => {
      findFirst.mockResolvedValue({ ...CATERVALLEY_ROW, isActive: false });
      const result = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(result).toEqual({ ok: false, reason: 'inactive' });
    });

    it('returns ok with the resolved partner on success', async () => {
      findFirst.mockResolvedValue(CATERVALLEY_ROW);
      const result = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(result).toEqual({
        ok: true,
        partner: {
          id: 'cv-id',
          slug: 'catervalley',
          displayName: 'CaterValley',
          orderPrefix: 'CV-',
          webhookUrl: 'https://api.catervalley.com/webhook',
          webhookSecret: 'cv-webhook-secret',
          rateLimitPerMin: 100,
          isActive: true,
        },
      });
    });

    it('hashes the api key with SHA-256 before lookup', async () => {
      findFirst.mockResolvedValue(CATERVALLEY_ROW);
      await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(findFirst).toHaveBeenCalledWith({
        where: { apiKeyHash: VALID_KEY_HASH, deletedAt: null },
      });
    });
  });

  describe('cache-hit slug revalidation (regression for slug-spoof bug)', () => {
    // Cache is bypassed under NODE_ENV=test, but the prod path must
    // re-validate the slug header on every request. We mock the
    // bypass by manually invoking authenticate twice and asserting
    // the DB is hit each time when the slug differs.
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: ORIGINAL_NODE_ENV,
        writable: true,
        configurable: true,
      });
    });

    it('returns unknown_partner when a cached row\'s slug does not match a new request\'s slug header', async () => {
      // Prime the cache with a valid catervalley auth.
      findFirst.mockResolvedValueOnce(CATERVALLEY_ROW);
      const first = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(first).toEqual(expect.objectContaining({ ok: true }));

      // Same key, different slug header → must NOT serve the cached
      // catervalley auth back. Should reject as unknown_partner.
      const second = await authenticatePartner(
        buildRequest({ partner: 'catercow', 'x-api-key': VALID_KEY })
      );
      expect(second).toEqual({ ok: false, reason: 'unknown_partner' });

      // Confirms the second call did NOT re-fetch from DB (cache hit
      // path was exercised, but slug check rejected it).
      expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it('serves the cached row on a repeat request with the same slug', async () => {
      findFirst.mockResolvedValueOnce(CATERVALLEY_ROW);
      const first = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      const second = await authenticatePartner(
        buildRequest({ partner: 'catervalley', 'x-api-key': VALID_KEY })
      );
      expect(first).toEqual(second);
      expect(findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPartnerBySlug', () => {
    it('returns the resolved partner for a known slug', async () => {
      findFirst.mockResolvedValue(CATERVALLEY_ROW);
      const partner = await getPartnerBySlug('catervalley');
      expect(partner?.slug).toBe('catervalley');
      expect(findFirst).toHaveBeenCalledWith({
        where: { slug: 'catervalley', deletedAt: null },
      });
    });

    it('returns null when no row matches', async () => {
      findFirst.mockResolvedValue(null);
      const partner = await getPartnerBySlug('nonexistent');
      expect(partner).toBeNull();
    });
  });

  describe('computeApiKeyHash', () => {
    it('returns a 64-character hex string for any input', () => {
      const hash = computeApiKeyHash('hello');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic — same input always produces the same hash', () => {
      expect(computeApiKeyHash('hello')).toBe(computeApiKeyHash('hello'));
    });

    it('produces different hashes for different inputs', () => {
      expect(computeApiKeyHash('hello')).not.toBe(computeApiKeyHash('world'));
    });
  });
});
