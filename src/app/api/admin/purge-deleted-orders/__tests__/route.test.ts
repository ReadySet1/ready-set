/**
 * /api/admin/purge-deleted-orders runs for a valid cron secret or an
 * ADMIN / SUPER_ADMIN user (same gate as data-archiving). The role comes from
 * the user's profile (getUserRole), not Supabase app_metadata.
 *
 * `dryRun` is accepted as `?dryRun=1` on GET and as a body field on POST;
 * the POST body may also override retentionDays and batchSize.
 */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/jobs/orderPurge', () => ({ runOrderPurge: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { runOrderPurge } from '@/jobs/orderPurge';
import { GET, POST } from '../route';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedRun = runOrderPurge as jest.Mock;

const CRON_SECRET = 'test-cron-secret';
const URL = 'http://localhost:3000/api/admin/purge-deleted-orders';
const CUTOFF = new Date('2024-10-06T12:00:00.000Z');

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

const cronHeaders = { authorization: `Bearer ${CRON_SECRET}` };

const get = (query = '', headers: Record<string, string> = {}) =>
  GET(new NextRequest(`${URL}${query}`, { headers }));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest(URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );

const jobResult = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  dryRun: false,
  retentionDays: 730,
  cutoff: CUTOFF,
  scanned: 0,
  purged: 0,
  failed: 0,
  orphanedFiles: 0,
  orders: [],
  durationMs: 5,
  ...overrides,
});

describe('/api/admin/purge-deleted-orders', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    signInAs(null);
    mockedRun.mockResolvedValue(jobResult());
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  describe('authorization', () => {
    it('rejects unauthenticated requests without a cron secret with 401 and runs nothing', async () => {
      const res = await get();

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it('rejects a wrong cron secret with 401', async () => {
      const res = await get('', { authorization: 'Bearer nope' });

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it.each(['HELPDESK', 'DRIVER'])('rejects a %s profile with 401', async (role) => {
      signInAs({ id: 'u-1', app_metadata: {} });
      mockedRole.mockResolvedValue(role);

      const res = await get();

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it('runs for a valid cron secret without a user', async () => {
      const res = await get('', cronHeaders);

      expect(res.status).toBe(200);
      expect(mockedRun).toHaveBeenCalled();
    });

    it.each(['ADMIN', 'SUPER_ADMIN'])('runs for an %s profile', async (role) => {
      signInAs({ id: 'sa-1', app_metadata: {} });
      mockedRole.mockResolvedValue(role);

      const res = await get();

      expect(res.status).toBe(200);
      expect(mockedRun).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('runs for real by default on GET', async () => {
      await get('', cronHeaders);

      expect(mockedRun).toHaveBeenCalledWith({ dryRun: false });
    });

    it.each(['1', 'true'])('passes dryRun through from ?dryRun=%s on GET', async (value) => {
      mockedRun.mockResolvedValue(jobResult({ dryRun: true }));

      const res = await get(`?dryRun=${value}`, cronHeaders);
      const data = await res.json();

      expect(mockedRun).toHaveBeenCalledWith({ dryRun: true });
      expect(data.dryRun).toBe(true);
    });

    it('passes dryRun, retentionDays and batchSize through from the POST body', async () => {
      await post({ dryRun: true, retentionDays: 365, batchSize: 10 }, cronHeaders);

      expect(mockedRun).toHaveBeenCalledWith({ dryRun: true, retentionDays: 365, batchSize: 10 });
    });

    it('ignores non-numeric overrides and an unparseable body', async () => {
      await post({ retentionDays: 'soon', batchSize: null }, cronHeaders);
      expect(mockedRun).toHaveBeenLastCalledWith({ dryRun: false });

      await POST(
        new NextRequest(URL, { method: 'POST', headers: cronHeaders, body: 'not json' }),
      );
      expect(mockedRun).toHaveBeenLastCalledWith({ dryRun: false });
    });
  });

  describe('response', () => {
    it('answers 200 with the job result when every order purged', async () => {
      mockedRun.mockResolvedValue(
        jobResult({
          scanned: 1,
          purged: 1,
          orders: [
            {
              orderType: 'catering',
              orderId: 'id-1',
              orderNumber: 'CAT-001',
              deletedAt: CUTOFF,
              outcome: 'PURGED',
              files: 2,
            },
          ],
        }),
      );

      const res = await get('', cronHeaders);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        dryRun: false,
        retentionDays: 730,
        cutoff: CUTOFF.toISOString(),
        scanned: 1,
        purged: 1,
        failed: 0,
        orphanedFiles: 0,
        message: expect.stringMatching(/purged 1/i),
      });
      expect(data.orders[0]).toMatchObject({ orderNumber: 'CAT-001', outcome: 'PURGED', files: 2 });
    });

    it('answers 207 when some orders failed', async () => {
      mockedRun.mockResolvedValue(jobResult({ success: false, scanned: 2, purged: 1, failed: 1 }));

      const res = await get('', cronHeaders);
      const data = await res.json();

      expect(res.status).toBe(207);
      expect(data.success).toBe(false);
      expect(data.message).toMatch(/1 failed/i);
    });

    it('answers 500 and reports to Sentry when the job throws', async () => {
      mockedRun.mockRejectedValue(new Error('db down'));

      const res = await get('', cronHeaders);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data).toMatchObject({ success: false, error: 'db down' });
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ tags: { operation: 'purge-deleted-orders' } }),
      );
    });
  });
});
