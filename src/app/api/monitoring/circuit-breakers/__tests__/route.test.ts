/**
 * /api/monitoring/circuit-breakers: viewing (GET) and resetting (POST) are
 * ADMIN / SUPER_ADMIN only. The role comes from the user's profile
 * (getUserRole), not Supabase app_metadata, which is never populated.
 */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/utils/api-resilience', () => ({
  caterValleyCircuitBreaker: {
    getMonitoringData: jest.fn(),
    reset: jest.fn(),
  },
}));
jest.mock('@/utils/logger', () => ({
  apiResilienceLogger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { caterValleyCircuitBreaker } from '@/utils/api-resilience';
import { GET, POST } from '../route';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedReset = caterValleyCircuitBreaker.reset as jest.Mock;

const URL_BASE = 'http://localhost:3000/api/monitoring/circuit-breakers';

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

const getRequest = () => new NextRequest(URL_BASE);
const postRequest = () =>
  new NextRequest(URL_BASE, {
    method: 'POST',
    body: JSON.stringify({ name: 'CaterValley' }),
    headers: { 'content-type': 'application/json' },
  });

describe('/api/monitoring/circuit-breakers authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (caterValleyCircuitBreaker.getMonitoringData as jest.Mock).mockReturnValue({
      name: 'CaterValley',
      state: 'closed',
      health: { status: 'healthy', message: 'ok' },
    });
  });

  describe('GET', () => {
    it('returns monitoring data for a SUPER_ADMIN profile without an app_metadata role', async () => {
      signInAs({ id: 'sa-1', app_metadata: {} });
      mockedRole.mockResolvedValue('SUPER_ADMIN');

      const res = await GET(getRequest());

      expect(res.status).toBe(200);
    });

    it.each(['HELPDESK', 'DRIVER'])('forbids a %s profile with 403', async (role) => {
      signInAs({ id: 'u-1', app_metadata: {} });
      mockedRole.mockResolvedValue(role);

      const res = await GET(getRequest());

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      signInAs(null);

      const res = await GET(getRequest());

      expect(res.status).toBe(401);
    });
  });

  describe('POST', () => {
    it('resets the breaker for a SUPER_ADMIN profile without an app_metadata role', async () => {
      signInAs({ id: 'sa-1', app_metadata: {} });
      mockedRole.mockResolvedValue('SUPER_ADMIN');

      const res = await POST(postRequest());

      expect(res.status).toBe(200);
      expect(mockedReset).toHaveBeenCalled();
    });

    it.each(['HELPDESK', 'DRIVER'])('forbids a %s profile with 403', async (role) => {
      signInAs({ id: 'u-1', app_metadata: {} });
      mockedRole.mockResolvedValue(role);

      const res = await POST(postRequest());

      expect(res.status).toBe(403);
      expect(mockedReset).not.toHaveBeenCalled();
    });

    it('rejects unauthenticated requests with 401', async () => {
      signInAs(null);

      const res = await POST(postRequest());

      expect(res.status).toBe(401);
      expect(mockedReset).not.toHaveBeenCalled();
    });
  });
});
