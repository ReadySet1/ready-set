/**
 * /api/debug/feature-flags is an engineering-only route: it must be gated by
 * devOnlyGuard() AND withAuth (admin roles).
 */
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/auth/dev-only-guard', () => ({ devOnlyGuard: jest.fn(() => null) }));
jest.mock('@/lib/feature-flags', () => ({
  FEATURE_FLAGS: {
    USE_REALTIME_TRACKING: 'a',
    USE_REALTIME_LOCATION_UPDATES: 'b',
    USE_REALTIME_ADMIN_DASHBOARD: 'c',
    REALTIME_FALLBACK_TO_SSE: 'd',
    REALTIME_FALLBACK_TO_REST: 'e',
  },
  isFeatureEnabled: jest.fn(() => false),
  getAllFeatureConfigs: jest.fn(() => ({})),
}));

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { devOnlyGuard } from '@/lib/auth/dev-only-guard';
import { GET } from '../route';

const mockedWithAuth = withAuth as jest.Mock;
const mockedGuard = devOnlyGuard as jest.Mock;
const request = () => new NextRequest('http://localhost:3000/api/debug/feature-flags');

describe('GET /api/debug/feature-flags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuard.mockReturnValue(null);
  });

  it('is hidden by devOnlyGuard in production', async () => {
    mockedGuard.mockReturnValue(NextResponse.json({ error: 'Not Found' }, { status: 404 }));
    const res = await GET(request());
    expect(res.status).toBe(404);
    expect(mockedGuard).toHaveBeenCalled();
    expect(mockedWithAuth).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      context: {},
    });
    expect((await GET(request())).status).toBe(401);
  });

  it('returns 403 for non-admin roles', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
      context: {},
    });
    expect((await GET(request())).status).toBe(403);
  });

  it('returns the flags for admins', async () => {
    mockedWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'a-1', email: 'a@rs.com', type: 'ADMIN' } },
    });
    expect((await GET(request())).status).toBe(200);
  });
});
