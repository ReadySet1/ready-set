/**
 * GET /api/tracking/shifts/[id]/trail — admin-only GeoJSON trail of a shift.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));
jest.mock('@/lib/auth-middleware');

import { NextRequest } from 'next/server';
import { GET } from '../[id]/trail/route';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';

const mockWithAuth = withAuth as jest.Mock;
const mockQuery = prisma.$queryRawUnsafe as jest.Mock;

const SHIFT_ID = '5bae9262-0000-0000-0000-000000000000';
const URL = `http://localhost:3000/api/tracking/shifts/${SHIFT_ID}/trail`;

const call = () => GET(new NextRequest(URL), { params: Promise.resolve({ id: SHIFT_ID }) });

function authAs(type: string) {
  mockWithAuth.mockImplementation(async (_req, options) => {
    const allowed = (options?.allowedRoles ?? []).includes(type);
    if (!allowed) {
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
        context: {},
      };
    }
    return { success: true, context: { user: { id: 'u-1', email: 'u@example.com', type } } };
  });
}

describe('GET /api/tracking/shifts/[id]/trail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects drivers (admin-only route)', async () => {
    authAs('DRIVER');
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'SUPER_ADMIN', 'HELPDESK'])('allows %s', async (role) => {
    authAs(role);
    mockQuery
      .mockResolvedValueOnce([{ id: SHIFT_ID, driver_id: 'drv-1', shift_start: new Date('2026-08-21T18:48:00Z'), shift_end: null }])
      .mockResolvedValueOnce([]);
    const res = await call();
    expect(res.status).toBe(200);
  });

  it('404s for an unknown (or soft-deleted) shift', async () => {
    authAs('ADMIN');
    mockQuery.mockResolvedValueOnce([]);
    const res = await call();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    // Shift lookup must exclude soft-deleted rows.
    expect(String(mockQuery.mock.calls[0]?.[0])).toMatch(/deleted_at IS NULL/);
  });

  it('returns the trail as a GeoJSON LineString ordered by recorded_at with a point count', async () => {
    authAs('ADMIN');
    mockQuery
      .mockResolvedValueOnce([{ id: SHIFT_ID, driver_id: 'drv-1', shift_start: new Date('2026-08-21T18:48:00Z'), shift_end: null }])
      .mockResolvedValueOnce([
        { longitude: -101.7, latitude: 21.13, recorded_at: new Date('2026-08-21T19:02:00Z') },
        { longitude: -101.6, latitude: 21.12, recorded_at: new Date('2026-08-21T19:00:00Z') },
        { longitude: -101.6, latitude: 21.12, recorded_at: new Date('2026-08-21T19:00:10Z') },
      ]);
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.shiftId).toBe(SHIFT_ID);
    expect(json.data.driverId).toBe('drv-1');
    expect(json.data.trail.type).toBe('Feature');
    expect(json.data.trail.geometry.type).toBe('LineString');
    expect(json.data.trail.geometry.coordinates).toEqual([[-101.6, 21.12], [-101.7, 21.13]]);
    expect(json.data.pointCount).toBe(2);

    // The locations query is scoped to the shift's driver + window and soft-delete filtered.
    const [sql, ...args] = mockQuery.mock.calls[1]!;
    expect(String(sql)).toMatch(/deleted_at IS NULL/);
    expect(String(sql)).toMatch(/ORDER BY recorded_at ASC/);
    expect(args[0]).toBe('drv-1');
  });
});
