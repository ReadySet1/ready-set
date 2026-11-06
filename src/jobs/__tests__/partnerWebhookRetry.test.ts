// Orchestration tests for the partner webhook retry worker: claim → load →
// signed resend → record, terminal-failure reporting, soft-deleted or
// unconfigured partners, and per-row failure isolation. The queue
// primitives themselves are covered in partner-webhook-queue.test.ts.

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/db/prisma';
import {
  claimDueDeliveries,
  recordAttemptResult,
  sendSignedWebhook,
} from '@/lib/services/partner-webhook-queue';
import { runPartnerWebhookRetry, DEFAULT_RETRY_BATCH_SIZE } from '@/jobs/partnerWebhookRetry';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { partnerWebhookDelivery: { findMany: jest.fn() } },
}));

jest.mock('@/lib/services/partner-webhook-queue', () => ({
  MAX_WEBHOOK_ATTEMPTS: 5,
  claimDueDeliveries: jest.fn(),
  recordAttemptResult: jest.fn(),
  sendSignedWebhook: jest.fn(),
}));

jest.mock('@/lib/services/webhook-logger', () => ({
  webhookLogger: { logSuccess: jest.fn(), logFailure: jest.fn() },
}));

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

jest.mock('@/utils/logger', () => ({
  carrierLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const claim = claimDueDeliveries as jest.Mock;
const record = recordAttemptResult as jest.Mock;
const send = sendSignedWebhook as jest.Mock;
const findMany = prisma.partnerWebhookDelivery.findMany as jest.Mock;

const PARTNER = {
  id: 'partner-cc-id',
  slug: 'catercow',
  webhookUrl: 'https://hook.example.com/ready_set',
  webhookSecret: 'shared-secret',
  isActive: true,
  deletedAt: null,
};

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'd-1',
  orderNumber: 'CC-1',
  eventStatus: 'PICKED_UP',
  payload: { orderId: 'o-1', status: 'PICKED_UP', timestamp: '2026-10-16T12:00:00.000Z' },
  attempts: 1,
  partner: PARTNER,
  ...overrides,
});

const OK = { ok: true, httpStatus: 200, error: null, responseTimeMs: 5 };
const FAIL = { ok: false, httpStatus: 502, error: 'HTTP 502', responseTimeMs: 5 };

beforeEach(() => {
  jest.clearAllMocks();
  claim.mockResolvedValue(['d-1']);
  findMany.mockResolvedValue([row()]);
  send.mockResolvedValue(OK);
  record.mockResolvedValue('succeeded');
});

describe('runPartnerWebhookRetry', () => {
  it('does nothing when no delivery is due', async () => {
    claim.mockResolvedValueOnce([]);

    const result = await runPartnerWebhookRetry();

    expect(result).toMatchObject({ success: true, claimed: 0, succeeded: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('claims with the default batch size and loads only still-PENDING rows', async () => {
    await runPartnerWebhookRetry();

    expect(claim).toHaveBeenCalledWith(DEFAULT_RETRY_BATCH_SIZE);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['d-1'] }, state: 'PENDING' },
      include: { partner: true },
    });
  });

  it('resends the stored payload signed with the partner secret and records the attempt', async () => {
    const result = await runPartnerWebhookRetry();

    expect(send).toHaveBeenCalledWith({
      url: PARTNER.webhookUrl,
      secret: PARTNER.webhookSecret,
      body: JSON.stringify(row().payload),
    });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1', attempts: 1 }), OK);
    expect(result).toMatchObject({ success: true, claimed: 1, succeeded: 1, retrying: 0, failed: 0 });
  });

  it('counts a retryable failure without reporting it', async () => {
    send.mockResolvedValueOnce(FAIL);
    record.mockResolvedValueOnce('retrying');

    const result = await runPartnerWebhookRetry();

    expect(result).toMatchObject({ retrying: 1, failed: 0 });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('reports a terminal failure after the 5th attempt to Sentry/GlitchTip', async () => {
    findMany.mockResolvedValueOnce([row({ attempts: 4 })]);
    send.mockResolvedValueOnce(FAIL);
    record.mockResolvedValueOnce('failed');

    const result = await runPartnerWebhookRetry();

    expect(result).toMatchObject({ failed: 1 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('5 attempts'),
      expect.objectContaining({
        level: 'error',
        tags: expect.objectContaining({ operation: 'partner-webhook-retry', partner: 'catercow' }),
        extra: expect.objectContaining({ orderNumber: 'CC-1', lastError: 'HTTP 502', lastStatusCode: 502 }),
      }),
    );
  });

  it.each([
    ['soft-deleted', { deletedAt: new Date('2026-10-01') }],
    ['inactive', { isActive: false }],
    ['missing its webhook URL', { webhookUrl: null }],
  ])('burns an attempt without sending when the partner is %s', async (_label, partnerOverride) => {
    findMany.mockResolvedValueOnce([row({ partner: { ...PARTNER, ...partnerOverride } })]);
    record.mockResolvedValueOnce('retrying');

    await runPartnerWebhookRetry();

    expect(send).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd-1' }),
      expect.objectContaining({ ok: false, httpStatus: null, error: expect.stringMatching(/partner/) }),
    );
  });

  it('isolates a per-row error so the rest of the batch still runs', async () => {
    claim.mockResolvedValueOnce(['d-1', 'd-2']);
    findMany.mockResolvedValueOnce([row(), row({ id: 'd-2' })]);
    record.mockRejectedValueOnce(new Error('db blip')).mockResolvedValueOnce('succeeded');

    const result = await runPartnerWebhookRetry();

    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ success: false, claimed: 2, succeeded: 1, errors: 1 });
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
