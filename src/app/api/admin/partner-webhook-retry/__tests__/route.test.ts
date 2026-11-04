/**
 * /api/admin/partner-webhook-retry runs for a valid cron secret or an
 * ADMIN / SUPER_ADMIN user (same gate as purge-deleted-orders). The role
 * comes from the user's profile (getUserRole), not Supabase app_metadata.
 */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/jobs/partnerWebhookRetry', () => ({ runPartnerWebhookRetry: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { runPartnerWebhookRetry } from '@/jobs/partnerWebhookRetry';
import { GET, POST } from '../route';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedRun = runPartnerWebhookRetry as jest.Mock;

const CRON_SECRET = 'test-cron-secret';
const URL = 'http://localhost:3000/api/admin/partner-webhook-retry';
const cronHeaders = { authorization: `Bearer ${CRON_SECRET}` };

function signInAs(user: { id: string } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

const get = (headers: Record<string, string> = {}) => GET(new NextRequest(URL, { headers }));

const jobResult = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  claimed: 2,
  succeeded: 1,
  retrying: 1,
  failed: 0,
  stale: 0,
  errors: 0,
  durationMs: 7,
  ...overrides,
});

describe('/api/admin/partner-webhook-retry', () => {
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
    it('rejects a request without a cron secret or session with 401 and runs nothing', async () => {
      const res = await get();

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalled();
    });

    it('rejects a wrong cron secret with 401', async () => {
      const res = await get({ authorization: 'Bearer nope' });

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it('rejects a bearer token when CRON_SECRET is unset', async () => {
      delete process.env.CRON_SECRET;

      const res = await get({ authorization: 'Bearer undefined' });

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it.each(['HELPDESK', 'DRIVER', 'CLIENT'])('rejects a %s profile with 401', async (role) => {
      signInAs({ id: 'u-1' });
      mockedRole.mockResolvedValue(role);

      const res = await get();

      expect(res.status).toBe(401);
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it('runs for a valid cron secret without a user', async () => {
      const res = await get(cronHeaders);

      expect(res.status).toBe(200);
      expect(mockedRun).toHaveBeenCalledTimes(1);
    });

    it.each(['ADMIN', 'SUPER_ADMIN'])('runs for an %s profile', async (role) => {
      signInAs({ id: 'sa-1' });
      mockedRole.mockResolvedValue(role);

      const res = await get();

      expect(res.status).toBe(200);
      expect(mockedRun).toHaveBeenCalledTimes(1);
    });

    it('accepts POST with the same gate', async () => {
      const res = await POST(new NextRequest(URL, { method: 'POST', headers: cronHeaders }));

      expect(res.status).toBe(200);
      expect(mockedRun).toHaveBeenCalledTimes(1);
    });
  });

  describe('response', () => {
    it('returns the run counts', async () => {
      const res = await get(cronHeaders);
      const body = await res.json();

      expect(body).toMatchObject({
        success: true,
        claimed: 2,
        succeeded: 1,
        retrying: 1,
        failed: 0,
        stale: 0,
        errors: 0,
        duration: '7ms',
      });
    });

    it('answers 207 when some deliveries errored', async () => {
      mockedRun.mockResolvedValueOnce(jobResult({ success: false, errors: 1 }));

      const res = await get(cronHeaders);

      expect(res.status).toBe(207);
    });

    it('answers 500 and reports when the run throws', async () => {
      mockedRun.mockRejectedValueOnce(new Error('db down'));

      const res = await get(cronHeaders);

      expect(res.status).toBe(500);
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ tags: { operation: 'partner-webhook-retry' } }),
      );
    });
  });
});
