/**
 * /api/admin/quarantine-cleanup runs for a valid cron secret or an
 * ADMIN / SUPER_ADMIN user. The role comes from the user's profile
 * (getUserRole), not Supabase app_metadata, which is never populated.
 */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/lib/upload-security', () => ({
  UploadSecurityManager: {
    cleanupQuarantinedFiles: jest.fn(),
    cleanupExpiredRateLimits: jest.fn(),
  },
}));

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { UploadSecurityManager } from '@/lib/upload-security';
import { GET } from '../route';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedRun = UploadSecurityManager.cleanupQuarantinedFiles as jest.Mock;

const CRON_SECRET = 'test-cron-secret';

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

const request = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost:3000/api/admin/quarantine-cleanup', { headers });

describe('/api/admin/quarantine-cleanup authorization', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    mockedRun.mockResolvedValue(0);
    (UploadSecurityManager.cleanupExpiredRateLimits as jest.Mock).mockReturnValue(0);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it.each(['ADMIN', 'SUPER_ADMIN'])('runs for profile role %s without an app_metadata role', async (role) => {
    signInAs({ id: 'sa-1', app_metadata: {} });
    mockedRole.mockResolvedValue(role);

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mockedRun).toHaveBeenCalled();
  });

  it.each(['HELPDESK', 'DRIVER'])('rejects a %s profile with 401', async (role) => {
    signInAs({ id: 'u-1', app_metadata: {} });
    mockedRole.mockResolvedValue(role);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests without a cron secret with 401', async () => {
    signInAs(null);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it('runs for a valid cron secret without a user', async () => {
    signInAs(null);

    const res = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));

    expect(res.status).toBe(200);
    expect(mockedRun).toHaveBeenCalled();
  });
});
