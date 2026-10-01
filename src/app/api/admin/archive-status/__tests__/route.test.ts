/**
 * GET /api/admin/archive-status is ADMIN / SUPER_ADMIN only. The role comes
 * from the user's profile (getUserRole), not Supabase app_metadata, which is
 * never populated.
 */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));
jest.mock('@/jobs/dataArchiving', () => ({ getArchiveMetrics: jest.fn() }));
jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    cateringRequest: { count: jest.fn() },
    onDemand: { count: jest.fn() },
    driverLocation: { count: jest.fn() },
    driverShift: { count: jest.fn() },
    driverWeeklySummary: { count: jest.fn() },
  },
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserRole } from '@/lib/auth';
import { getArchiveMetrics } from '@/jobs/dataArchiving';
import { prisma } from '@/utils/prismaDB';
import { GET } from '../route';

const mockedCreateClient = createClient as jest.Mock;
const mockedRole = getUserRole as jest.Mock;
const mockedMetrics = getArchiveMetrics as jest.Mock;

function signInAs(user: { id: string; app_metadata: Record<string, unknown> } | null) {
  mockedCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

const request = () => new NextRequest('http://localhost:3000/api/admin/archive-status');

describe('GET /api/admin/archive-status authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMetrics.mockResolvedValue({
      driverLocations: {},
      driverShifts: {},
      orders: {},
      recentBatches: [],
    });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ count: BigInt(0) }]);
    for (const model of [
      prisma.cateringRequest,
      prisma.onDemand,
      prisma.driverLocation,
      prisma.driverShift,
      prisma.driverWeeklySummary,
    ]) {
      (model.count as jest.Mock).mockResolvedValue(0);
    }
  });

  it('returns metrics for a SUPER_ADMIN profile without an app_metadata role', async () => {
    signInAs({ id: 'sa-1', app_metadata: {} });
    mockedRole.mockResolvedValue('SUPER_ADMIN');

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(mockedMetrics).toHaveBeenCalled();
  });

  it.each(['HELPDESK', 'DRIVER'])('rejects a %s profile with 401', async (role) => {
    signInAs({ id: 'u-1', app_metadata: {} });
    mockedRole.mockResolvedValue(role);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockedMetrics).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401', async () => {
    signInAs(null);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(mockedMetrics).not.toHaveBeenCalled();
  });
});
