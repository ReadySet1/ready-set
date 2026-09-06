/**
 * /api/test-umami is an engineering-only route: it must be gated by
 * devOnlyGuard() AND withAuth SUPER_ADMIN.
 */
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/auth/dev-only-guard', () => ({ devOnlyGuard: jest.fn(() => null) }));

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { devOnlyGuard } from '@/lib/auth/dev-only-guard';
import { GET } from '../route';

const mockedWithAuth = withAuth as jest.Mock;
const mockedGuard = devOnlyGuard as jest.Mock;

const request = () => new NextRequest('http://localhost:3000/api/test-umami');

describe('GET /api/test-umami', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuard.mockReturnValue(null);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
    }) as unknown as typeof fetch;
  });

  it('returns 404 in production before touching auth', async () => {
    mockedGuard.mockReturnValue(NextResponse.json({ error: 'Not Found' }, { status: 404 }));
    const res = await GET(request());
    expect(res.status).toBe(404);
    expect(mockedWithAuth).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      context: {},
    });
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-super-admins', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
      context: {},
    });
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(mockedWithAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowedRoles: ['SUPER_ADMIN'], requireAuth: true }),
    );
  });

  it('runs the connectivity checks for super admins', async () => {
    mockedWithAuth.mockResolvedValue({
      success: true,
      context: { user: { id: 'sa-1', email: 'sa@rs.com', type: 'SUPER_ADMIN' } },
    });
    const res = await GET(request());
    expect(res.status).toBe(200);
  });
});
