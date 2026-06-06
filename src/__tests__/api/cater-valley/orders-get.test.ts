// src/__tests__/api/cater-valley/orders-get.test.ts
//
// GET /api/cater-valley/orders/{id} (aliased at /api/partners/orders/{id}):
// returns current status + recent lifecycle events, enforces ownership,
// and 404s on unknown/soft-deleted orders.

import { GET } from '@/app/api/cater-valley/orders/[id]/route';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: { cateringRequest: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/services/partner-registry', () => ({
  authenticatePartner: jest.fn(async (req: Request) => {
    const slug = req.headers.get('partner');
    const apiKey = req.headers.get('x-api-key');
    if (!slug) return { ok: false, reason: 'missing_partner_header' };
    if (!apiKey) return { ok: false, reason: 'missing_api_key' };
    if (slug === 'catercow' && apiKey === 'cc-test-key') {
      return {
        ok: true,
        partner: {
          id: 'partner-cc-id',
          slug: 'catercow',
          displayName: 'CaterCow',
          orderPrefix: 'CC-',
          webhookUrl: null,
          webhookSecret: null,
          rateLimitPerMin: 100,
          isActive: true,
        },
      };
    }
    return { ok: false, reason: 'invalid_key' };
  }),
}));

const ORDER_ID = '123e4567-e89b-12d3-a456-426614174000';

function makeRequest(headers: Record<string, string>) {
  return new Request(`http://localhost/api/cater-valley/orders/${ORDER_ID}`, { headers }) as any;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const authHeaders = { partner: 'catercow', 'x-api-key': 'cc-test-key' };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/cater-valley/orders/{id}', () => {
  it('401s without credentials', async () => {
    const res = await GET(makeRequest({}), ctx(ORDER_ID));
    expect(res.status).toBe(401);
  });

  it('400s on a non-UUID id', async () => {
    const res = await GET(makeRequest(authHeaders), ctx('not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('404s when the order does not exist', async () => {
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(authHeaders), ctx(ORDER_ID));
    expect(res.status).toBe(404);
  });

  it('404s when the order is soft-deleted', async () => {
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: ORDER_ID,
      orderNumber: 'CC-12345',
      deletedAt: new Date(),
      user: { email: 'system@catercow.com' },
      statusHistory: [],
    });
    const res = await GET(makeRequest(authHeaders), ctx(ORDER_ID));
    expect(res.status).toBe(404);
  });

  it("403s when the order belongs to a different partner", async () => {
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: ORDER_ID,
      orderNumber: 'CV-999', // not CaterCow's prefix
      deletedAt: null,
      status: 'CONFIRMED',
      arrivalDateTime: null,
      user: { email: 'system@catervalley.com' },
      statusHistory: [],
    });
    const res = await GET(makeRequest(authHeaders), ctx(ORDER_ID));
    expect(res.status).toBe(403);
  });

  it('returns current status + lifecycle events for an owned order', async () => {
    (prisma.cateringRequest.findUnique as jest.Mock).mockResolvedValueOnce({
      id: ORDER_ID,
      orderNumber: 'CC-12345',
      deletedAt: null,
      status: 'CONFIRMED',
      arrivalDateTime: new Date('2026-06-15T18:30:00Z'),
      user: { email: 'system@catercow.com' },
      statusHistory: [
        { partnerStatus: 'PICKED_UP', driverStatus: 'PICKED_UP', createdAt: new Date('2026-06-15T17:00:00Z'), location: null, notes: null },
        { partnerStatus: 'ASSIGNED', driverStatus: 'ASSIGNED', createdAt: new Date('2026-06-15T16:00:00Z'), location: null, notes: null },
      ],
    });

    const res = await GET(makeRequest(authHeaders), ctx(ORDER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('SUCCESS');
    expect(body.order).toMatchObject({
      id: ORDER_ID,
      orderCode: '12345',
      orderNumber: 'CC-12345',
      orderStatus: 'CONFIRMED',
      lifecycleStatus: 'PICKED_UP', // newest event
    });
    expect(body.order.events).toHaveLength(2);
    expect(body.order.events[0]).toMatchObject({ status: 'PICKED_UP', driverStatus: 'PICKED_UP' });
  });
});
