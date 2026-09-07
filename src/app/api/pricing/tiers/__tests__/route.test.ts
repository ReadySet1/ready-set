/**
 * Auth gating for pricing tier writes.
 * GET stays public (the calculator reads tiers); POST/PUT/DELETE are
 * ADMIN / SUPER_ADMIN only.
 */
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/services/pricing/pricing.service', () => ({
  PricingService: jest.fn().mockImplementation(() => ({
    getAllTiers: jest.fn().mockResolvedValue([]),
    getTierById: jest.fn().mockResolvedValue({ id: 'tier-1' }),
    createTier: jest.fn().mockResolvedValue({ id: 'tier-1' }),
    updateTier: jest.fn().mockResolvedValue({ id: 'tier-1' }),
    deleteTier: jest.fn().mockResolvedValue(true),
  })),
}));

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { GET as listTiers, POST } from '../route';
import { PUT, DELETE } from '../[id]/route';
import {
  createPostRequest,
  createPutRequest,
  createDeleteRequest,
} from '@/__tests__/helpers/api-test-helpers';

const mockedWithAuth = withAuth as jest.Mock;

const authOk = (type: string) => ({
  success: true,
  context: { user: { id: 'user-1', email: 'u@rs.com', type } },
});
const unauthenticated = () => ({
  success: false,
  response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
  context: {},
});
const forbidden = () => ({
  success: false,
  response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
  context: {},
});

const validTier = { minHeadCount: 10, minFoodCost: 100, priceWithTip: 50 };
const idContext = { params: Promise.resolve({ id: 'tier-1' }) };

describe('/api/pricing/tiers auth', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET stays public', async () => {
    const res = await listTiers();
    expect(res.status).toBe(200);
    expect(mockedWithAuth).not.toHaveBeenCalled();
  });

  describe('POST /api/pricing/tiers', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedWithAuth.mockResolvedValue(unauthenticated());
      const res = await POST(createPostRequest('http://localhost:3000/api/pricing/tiers', validTier));
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
      mockedWithAuth.mockResolvedValue(forbidden());
      const res = await POST(createPostRequest('http://localhost:3000/api/pricing/tiers', validTier));
      expect(res.status).toBe(403);
      expect(mockedWithAuth).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ allowedRoles: ['ADMIN', 'SUPER_ADMIN'] }),
      );
    });

    it('creates the tier for admins', async () => {
      mockedWithAuth.mockResolvedValue(authOk('ADMIN'));
      const res = await POST(createPostRequest('http://localhost:3000/api/pricing/tiers', validTier));
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/pricing/tiers/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedWithAuth.mockResolvedValue(unauthenticated());
      const res = await PUT(
        createPutRequest('http://localhost:3000/api/pricing/tiers/tier-1', { minHeadCount: 5 }),
        idContext,
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
      mockedWithAuth.mockResolvedValue(forbidden());
      const res = await PUT(
        createPutRequest('http://localhost:3000/api/pricing/tiers/tier-1', { minHeadCount: 5 }),
        idContext,
      );
      expect(res.status).toBe(403);
    });

    it('updates the tier for super admins', async () => {
      mockedWithAuth.mockResolvedValue(authOk('SUPER_ADMIN'));
      const res = await PUT(
        createPutRequest('http://localhost:3000/api/pricing/tiers/tier-1', { minHeadCount: 5 }),
        idContext,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/pricing/tiers/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      mockedWithAuth.mockResolvedValue(unauthenticated());
      const res = await DELETE(createDeleteRequest('http://localhost:3000/api/pricing/tiers/tier-1'), idContext);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin roles', async () => {
      mockedWithAuth.mockResolvedValue(forbidden());
      const res = await DELETE(createDeleteRequest('http://localhost:3000/api/pricing/tiers/tier-1'), idContext);
      expect(res.status).toBe(403);
    });

    it('deactivates the tier for admins', async () => {
      mockedWithAuth.mockResolvedValue(authOk('ADMIN'));
      const res = await DELETE(createDeleteRequest('http://localhost:3000/api/pricing/tiers/tier-1'), idContext);
      expect(res.status).toBe(200);
    });
  });
});
