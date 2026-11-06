// Unit tests for the durable partner webhook queue: backoff schedule,
// idempotent enqueue, the claim query, a single signed attempt, and the
// attempt-result state transitions (succeed / retry / fail-terminal).

import {
  MAX_WEBHOOK_ATTEMPTS,
  CLAIM_LEASE_MS,
  nextAttemptDelayMs,
  enqueuePartnerWebhook,
  claimDueDeliveries,
  sendSignedWebhook,
  recordAttemptResult,
} from '@/lib/services/partner-webhook-queue';
import { prisma } from '@/lib/db/prisma';
import { signPayload } from '@/lib/security/hmac';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    partnerWebhookDelivery: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/security/hmac', () => ({
  SIGNATURE_HEADER: 'x-readyset-signature',
  signPayload: jest.fn(async () => 'sig123'),
}));

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

jest.mock('@/utils/logger', () => ({
  carrierLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const delivery = prisma.partnerWebhookDelivery as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
};
const queryRaw = prisma.$queryRaw as unknown as jest.Mock;
const mockFetch = jest.fn();

const NOW = new Date('2026-10-16T12:00:00.000Z');
const MINUTE = 60_000;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe('backoff schedule', () => {
  it('allows 5 attempts in total', () => {
    expect(MAX_WEBHOOK_ATTEMPTS).toBe(5);
  });

  it('doubles the wait after each failed attempt: 2, 4, 8, 16 minutes', () => {
    expect(nextAttemptDelayMs(1)).toBe(2 * MINUTE);
    expect(nextAttemptDelayMs(2)).toBe(4 * MINUTE);
    expect(nextAttemptDelayMs(3)).toBe(8 * MINUTE);
    expect(nextAttemptDelayMs(4)).toBe(16 * MINUTE);
  });

  it('spreads the 5 attempts over 30 minutes', () => {
    const total = [1, 2, 3, 4].reduce((sum, n) => sum + (nextAttemptDelayMs(n) ?? 0), 0);
    expect(total).toBe(30 * MINUTE);
  });

  it('returns null once the 5th attempt has been made', () => {
    expect(nextAttemptDelayMs(5)).toBeNull();
    expect(nextAttemptDelayMs(6)).toBeNull();
  });

  it('keeps a claim lease of at least the first retry delay', () => {
    expect(CLAIM_LEASE_MS).toBeGreaterThanOrEqual(2 * MINUTE);
  });
});

describe('enqueuePartnerWebhook', () => {
  const input = {
    partnerId: 'partner-1',
    cateringRequestId: 'order-1',
    orderNumber: 'CC-1',
    statusHistoryId: 'hist-1',
    eventStatus: 'ASSIGNED',
    payload: { orderId: 'order-1', status: 'ASSIGNED' },
  };

  it('creates a PENDING row leased to the in-request first attempt', async () => {
    delivery.create.mockResolvedValueOnce({ id: 'd-1', attempts: 0 });

    const result = await enqueuePartnerWebhook(input, NOW);

    expect(result).toEqual({ id: 'd-1', attempts: 0, created: true });
    expect(delivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        partnerId: 'partner-1',
        cateringRequestId: 'order-1',
        orderNumber: 'CC-1',
        statusHistoryId: 'hist-1',
        eventStatus: 'ASSIGNED',
        payload: input.payload,
        state: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(NOW.getTime() + CLAIM_LEASE_MS),
      }),
      select: { id: true, attempts: true },
    });
  });

  it('is idempotent per status-history event: a duplicate returns the existing row', async () => {
    delivery.create.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }));
    delivery.findUnique.mockResolvedValueOnce({ id: 'd-existing', attempts: 2 });

    const result = await enqueuePartnerWebhook(input, NOW);

    expect(result).toEqual({ id: 'd-existing', attempts: 2, created: false });
    expect(delivery.findUnique).toHaveBeenCalledWith({
      where: { statusHistoryId: 'hist-1' },
      select: { id: true, attempts: true },
    });
  });

  it('returns null (never throws) when the queue write fails', async () => {
    delivery.create.mockRejectedValueOnce(new Error('relation does not exist'));

    await expect(enqueuePartnerWebhook(input, NOW)).resolves.toBeNull();
  });
});

describe('claimDueDeliveries', () => {
  it('claims due PENDING rows with SKIP LOCKED and pushes their lease forward', async () => {
    queryRaw.mockResolvedValueOnce([{ id: 'd-1' }, { id: 'd-2' }]);

    const ids = await claimDueDeliveries(25, NOW);

    expect(ids).toEqual(['d-1', 'd-2']);
    const [strings, ...values] = queryRaw.mock.calls[0];
    const sql = (strings as string[]).join('?');
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/"state" = 'PENDING'/);
    expect(sql).toMatch(/"next_attempt_at" <=/);
    expect(sql).toMatch(/SET "next_attempt_at" =/);
    expect(values).toEqual(expect.arrayContaining([NOW, new Date(NOW.getTime() + CLAIM_LEASE_MS), 25]));
  });

  it('returns an empty list when nothing is due', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(claimDueDeliveries(25, NOW)).resolves.toEqual([]);
  });
});

describe('sendSignedWebhook', () => {
  const target = { url: 'https://hook.example.com', secret: 'shh', body: '{"a":1}' };

  it('POSTs the body signed with the partner secret in x-readyset-signature', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const outcome = await sendSignedWebhook(target);

    expect(outcome).toMatchObject({ ok: true, httpStatus: 200, error: null });
    expect(signPayload).toHaveBeenCalledWith('shh', '{"a":1}');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://hook.example.com');
    expect(init).toMatchObject({ method: 'POST', body: '{"a":1}' });
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-readyset-signature': 'sig123' });
  });

  it('reports a non-2xx response as a failed attempt', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(sendSignedWebhook(target)).resolves.toMatchObject({
      ok: false,
      httpStatus: 503,
      error: 'HTTP 503',
    });
  });

  it('reports a network error without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(sendSignedWebhook(target)).resolves.toMatchObject({
      ok: false,
      httpStatus: null,
      error: 'ECONNREFUSED',
    });
  });
});

describe('recordAttemptResult', () => {
  const okOutcome = { ok: true, httpStatus: 200, error: null, responseTimeMs: 12 };
  const failOutcome = { ok: false, httpStatus: 500, error: 'HTTP 500', responseTimeMs: 12 };

  beforeEach(() => delivery.updateMany.mockResolvedValue({ count: 1 }));

  it('marks the row SUCCEEDED on a 2xx', async () => {
    const result = await recordAttemptResult({ id: 'd-1', attempts: 0 }, okOutcome, NOW);

    expect(result).toBe('succeeded');
    expect(delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1', state: 'PENDING', attempts: 0 },
      data: expect.objectContaining({
        state: 'SUCCEEDED',
        attempts: 1,
        nextAttemptAt: null,
        deliveredAt: NOW,
        lastAttemptAt: NOW,
        lastStatusCode: 200,
        lastError: null,
      }),
    });
  });

  it('schedules the next attempt with backoff after a non-terminal failure', async () => {
    const result = await recordAttemptResult({ id: 'd-1', attempts: 1 }, failOutcome, NOW);

    expect(result).toBe('retrying');
    expect(delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1', state: 'PENDING', attempts: 1 },
      data: expect.objectContaining({
        state: 'PENDING',
        attempts: 2,
        nextAttemptAt: new Date(NOW.getTime() + 4 * MINUTE),
        lastStatusCode: 500,
        lastError: 'HTTP 500',
      }),
    });
  });

  it('marks the row FAILED when the 5th attempt fails', async () => {
    const result = await recordAttemptResult({ id: 'd-1', attempts: 4 }, failOutcome, NOW);

    expect(result).toBe('failed');
    expect(delivery.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1', state: 'PENDING', attempts: 4 },
      data: expect.objectContaining({ state: 'FAILED', attempts: 5, nextAttemptAt: null }),
    });
  });

  it('reports stale when another worker already recorded this attempt', async () => {
    delivery.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(recordAttemptResult({ id: 'd-1', attempts: 1 }, failOutcome, NOW)).resolves.toBe('stale');
  });
});
