/**
 * Partner registry — DB-backed authentication for the partner order API.
 *
 * Replaces the prior single-partner env-var check (CATERVALLEY_API_KEY)
 * with a row in the `api_partners` table. Each partner row carries its
 * inbound API key hash, outbound webhook config, the labels (display
 * name + order number prefix) used when persisting orders, and a few
 * operational knobs.
 *
 * Lookup is keyed by SHA-256(apiKey) hex. Keys are generated with
 * `openssl rand -hex 32` (256 bits of entropy), so SHA-256 is fast,
 * indexable, and as secure as bcrypt would be against brute force.
 * Constant-time compare on the hex output preserves timing-attack
 * defense (and additionally compares slug-vs-header to catch
 * header/key mismatch).
 *
 * A 60s in-memory cache absorbs burst traffic without hitting the DB on
 * every request. Negative results are cached briefly (5s) to blunt
 * brute force. Cache is bypassed under NODE_ENV=test.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/db/prisma';

export interface ResolvedPartner {
  id: string;
  slug: string;
  displayName: string;
  orderPrefix: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  rateLimitPerMin: number;
  isActive: boolean;
}

export type AuthFailureReason =
  | 'missing_partner_header'
  | 'missing_api_key'
  | 'unknown_partner'
  | 'invalid_key'
  | 'inactive';

export type AuthResult =
  | { ok: true; partner: ResolvedPartner }
  | { ok: false; reason: AuthFailureReason };

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 5_000;
const CACHE_MAX_ENTRIES = 32;

interface CacheEntry {
  result: AuthResult;
  expiresAt: number;
}

const cacheByHash = new Map<string, CacheEntry>();
const cacheBySlug = new Map<string, { partner: ResolvedPartner; expiresAt: number }>();
let cacheActivePartners: { partners: ResolvedPartner[]; expiresAt: number } | null = null;

function bypassCache(): boolean {
  return process.env.NODE_ENV === 'test';
}

function pruneCache(): void {
  if (cacheByHash.size <= CACHE_MAX_ENTRIES) return;
  // Drop oldest insertion-order entries until we're under the cap.
  const drop = cacheByHash.size - CACHE_MAX_ENTRIES;
  let i = 0;
  for (const key of cacheByHash.keys()) {
    if (i++ >= drop) break;
    cacheByHash.delete(key);
  }
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function constantTimeStringEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function toResolvedPartner(row: {
  id: string;
  slug: string;
  displayName: string;
  orderPrefix: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  rateLimitPerMin: number;
  isActive: boolean;
}): ResolvedPartner {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    orderPrefix: row.orderPrefix,
    webhookUrl: row.webhookUrl,
    webhookSecret: row.webhookSecret,
    rateLimitPerMin: row.rateLimitPerMin,
    isActive: row.isActive,
  };
}

/**
 * Look up a partner by its slug. Used by legacy `/api/cater-valley/*`
 * shims that pin the slug rather than reading it from the request, and
 * by tests that need to fetch a known partner row.
 */
export async function getPartnerBySlug(slug: string): Promise<ResolvedPartner | null> {
  if (!bypassCache()) {
    const cached = cacheBySlug.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.partner;
    }
  }

  const row = await prisma.apiPartner.findFirst({
    where: { slug, deletedAt: null },
  });
  if (!row) return null;

  const partner = toResolvedPartner(row);
  if (!bypassCache()) {
    cacheBySlug.set(slug, { partner, expiresAt: Date.now() + POSITIVE_TTL_MS });
  }
  return partner;
}

/**
 * Resolve the partner that owns an order from its order number. Orders
 * are persisted with `orderNumber = <orderPrefix><orderCode>` (e.g.
 * `CC-12345`), so we match the order number against each active
 * partner's `orderPrefix`. Used by the outbound webhook dispatcher to
 * find the `webhookUrl` / `webhookSecret` for a status change.
 *
 * The active-partner list is tiny and cached for 60s, so this stays off
 * the hot path of every driver status update. When prefixes overlap the
 * longest match wins, so a more specific prefix can't be shadowed.
 */
export async function getPartnerByOrderNumber(orderNumber: string): Promise<ResolvedPartner | null> {
  if (!orderNumber) return null;

  let partners: ResolvedPartner[];
  if (!bypassCache() && cacheActivePartners && cacheActivePartners.expiresAt > Date.now()) {
    partners = cacheActivePartners.partners;
  } else {
    const rows = await prisma.apiPartner.findMany({
      where: { deletedAt: null, isActive: true },
    });
    partners = rows.map(toResolvedPartner);
    if (!bypassCache()) {
      cacheActivePartners = { partners, expiresAt: Date.now() + POSITIVE_TTL_MS };
    }
  }

  const match = partners
    .filter((p) => p.orderPrefix && orderNumber.startsWith(p.orderPrefix))
    .sort((a, b) => b.orderPrefix.length - a.orderPrefix.length)[0];
  return match ?? null;
}

/**
 * Authenticate a partner request. Reads the `partner` and `x-api-key`
 * headers, hashes the key, looks up the partner row, and verifies that
 * the resolved row's slug matches the header value. Active flag is
 * enforced after auth to give a distinct error reason.
 */
export async function authenticatePartner(request: NextRequest | Request): Promise<AuthResult> {
  const slugHeader = request.headers.get('partner');
  const apiKey = request.headers.get('x-api-key');

  if (!slugHeader) {
    return { ok: false, reason: 'missing_partner_header' };
  }
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  const apiKeyHash = hashApiKey(apiKey);

  if (!bypassCache()) {
    const cached = cacheByHash.get(apiKeyHash);
    if (cached && cached.expiresAt > Date.now()) {
      // Re-validate the slug header against the cached row even on a
      // cache hit. Without this, a valid key for partner A sent with
      // `partner: B` would return the cached partner A auth (because
      // the cache is keyed by hash alone), letting a caller smuggle
      // partner A's identity past the slug check.
      if (cached.result.ok && !constantTimeStringEquals(cached.result.partner.slug, slugHeader)) {
        return { ok: false, reason: 'unknown_partner' };
      }
      return cached.result;
    }
  }

  const row = await prisma.apiPartner.findFirst({
    where: { apiKeyHash, deletedAt: null },
  });

  let result: AuthResult;
  if (!row) {
    result = { ok: false, reason: 'invalid_key' };
  } else if (!constantTimeStringEquals(row.slug, slugHeader)) {
    // Defense against header/key mismatch: a valid key for partner A
    // sent with partner: B should never authenticate as either.
    result = { ok: false, reason: 'unknown_partner' };
  } else if (!row.isActive) {
    result = { ok: false, reason: 'inactive' };
  } else {
    result = { ok: true, partner: toResolvedPartner(row) };
  }

  if (!bypassCache()) {
    const ttl = result.ok ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
    cacheByHash.set(apiKeyHash, { result, expiresAt: Date.now() + ttl });
    pruneCache();
  }
  return result;
}

/**
 * Test-only: clear in-memory caches so subsequent calls re-read from
 * the database. Production callers do not need this — wait the TTL
 * (60s positive, 5s negative) instead.
 */
export function _resetPartnerCacheForTests(): void {
  cacheByHash.clear();
  cacheBySlug.clear();
  cacheActivePartners = null;
}

/**
 * Compute the SHA-256 hex hash of an API key. Exposed so seed scripts
 * and admin tooling can hash a freshly generated key before inserting
 * the row.
 */
export function computeApiKeyHash(apiKey: string): string {
  return hashApiKey(apiKey);
}
