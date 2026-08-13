/**
 * Tests for the pickup-confirmation POST route (formerly signature-only).
 * Policy since 2026-07-09: `receivedBy` (name) is REQUIRED, the signature file
 * is OPTIONAL. Auth + role + driver-assignment gating unchanged. The receiver
 * name (and signature URL when present) are upserted onto the standalone
 * `deliveries` row, which the PICKED_UP gate reads.
 */

jest.mock('@/utils/prismaDB');
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/supabase/storage', () => ({
  uploadPickupSignatureImage: jest.fn(),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { uploadPickupSignatureImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';

const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedUpload = uploadPickupSignatureImage as jest.Mock;
const mockedSentry = Sentry as unknown as { captureException: jest.Mock };

const SIG_URL = 'https://cdn.example.com/deliveries/pickup-signature.png';

const makeFile = () =>
  ({ name: 'pickup-signature.png', type: 'image/png', size: 512 } as unknown as File);

const createPostRequest = (
  orderNumber = 'CAT-001',
  file: File | null = makeFile(),
  receivedBy: string | null = 'Maria Lopez',
) => {
  const req = new NextRequest(
    `http://localhost:3000/api/orders/${orderNumber}/signature`,
    { method: 'POST' },
  );
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (k: string) => {
      if (k === 'file') return file;
      if (k === 'receivedBy') return receivedBy;
      return null;
    },
  });
  return req;
};

const setupMocks = (opts: { role?: string; user?: any } = {}) => {
  const role = opts.role ?? 'ADMIN';
  const user = opts.user === undefined ? { id: 'user-1' } : opts.user;

  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any);

  (mockedPrisma.profile.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1', type: role });
  (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
    id: 'order-123',
    orderNumber: 'CAT-001',
    deliveryAddress: { street1: '123 Client St' },
  });
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
  (mockedPrisma.dispatch.findFirst as jest.Mock).mockResolvedValue({ id: 'dispatch-1' });
  (mockedPrisma.fileUpload.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (mockedPrisma.fileUpload.create as jest.Mock).mockResolvedValue({ id: 'file-1' });
  (mockedPrisma.delivery.upsert as jest.Mock).mockResolvedValue({ id: 'delivery-1' });

  mockedUpload.mockResolvedValue({
    url: SIG_URL,
    path: 'deliveries/order-123/pickup-signature.png',
    error: null,
  });
};

const importRoute = async () => import('../route');
const params = (order_number: string) => ({ params: Promise.resolve({ order_number }) });

describe('pickup confirmation POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setupMocks({ user: null });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-driver/admin role', async () => {
    setupMocks({ role: 'CLIENT' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(403);
  });

  it('returns 404 when the order does not exist', async () => {
    setupMocks();
    (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('NOPE'), params('NOPE'));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a driver not assigned to the order', async () => {
    setupMocks({ role: 'DRIVER' });
    (mockedPrisma.dispatch.findFirst as jest.Mock).mockResolvedValue(null);
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params('CAT-001'));
    expect(res.status).toBe(403);
  });

  it('returns 400 when receivedBy is missing or blank', async () => {
    const { POST } = await importRoute();
    const missing = await POST(createPostRequest('CAT-001', makeFile(), null), params('CAT-001'));
    expect(missing.status).toBe(400);

    setupMocks();
    const blank = await POST(createPostRequest('CAT-001', makeFile(), '   '), params('CAT-001'));
    expect(blank.status).toBe(400);
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedPrisma.delivery.upsert as jest.Mock).not.toHaveBeenCalled();
  });

  it('uploads the signature and upserts name + URL onto the deliveries row', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBe(SIG_URL);
    expect(data.receivedBy).toBe('Maria Lopez');

    expect(mockedPrisma.fileUpload.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'pickup_signature',
          cateringRequestId: 'order-123',
        }),
      }),
    );

    expect(mockedPrisma.delivery.upsert as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderNumber: 'CAT-001' },
        update: expect.objectContaining({
          pickupReceivedBy: 'Maria Lopez',
          pickupSignatureUrl: SIG_URL,
        }),
        create: expect.objectContaining({
          orderNumber: 'CAT-001',
          deliveryAddress: '123 Client St',
          pickupReceivedBy: 'Maria Lopez',
          pickupSignatureUrl: SIG_URL,
        }),
      }),
    );
  });

  it('accepts a name-only confirmation (no signature file)', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001', null), params('CAT-001'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBeNull();
    expect(data.receivedBy).toBe('Maria Lopez');

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedPrisma.fileUpload.create as jest.Mock).not.toHaveBeenCalled();
    expect(mockedPrisma.delivery.upsert as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { pickupReceivedBy: 'Maria Lopez' },
      }),
    );
  });

  it('returns 500 when the upsert fails on a name-only confirmation (name is the gating artifact)', async () => {
    setupMocks();
    (mockedPrisma.delivery.upsert as jest.Mock).mockRejectedValue(new Error('db down'));
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001', null), params('CAT-001'));

    expect(res.status).toBe(500);
    expect(mockedSentry.captureException).toHaveBeenCalled();
  });

  it('stays non-fatal when the upsert fails but a signature was stored (gate passes via file_uploads)', async () => {
    setupMocks();
    (mockedPrisma.delivery.upsert as jest.Mock).mockRejectedValue(new Error('db down'));
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockedSentry.captureException).toHaveBeenCalled();
  });

  it('resolves the user from the Authorization header when cookies are stale', async () => {
    // 2026-08 field failure transport: stale auth cookies, valid Bearer token.
    const getUser = jest.fn(async (token?: string) =>
      token === 'tok-123'
        ? { data: { user: { id: 'user-1' } }, error: null }
        : { data: { user: null }, error: { message: 'no cookie session' } },
    );
    mockedCreateClient.mockResolvedValue({ auth: { getUser } } as any);

    const req = new NextRequest('http://localhost:3000/api/orders/CAT-001/signature', {
      method: 'POST',
      headers: { authorization: 'Bearer tok-123' },
    });
    (req as any).formData = jest.fn().mockResolvedValue({
      get: (k: string) => {
        if (k === 'file') return makeFile();
        if (k === 'receivedBy') return 'Maria Lopez';
        return null;
      },
    });

    const { POST } = await importRoute();
    const res = await POST(req, params('CAT-001'));

    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith('tok-123');
  });

  it('returns 500 and records nothing when the upload fails', async () => {
    setupMocks();
    mockedUpload.mockResolvedValue({ url: null, path: null, error: 'storage down' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(500);
    expect(mockedPrisma.delivery.upsert as jest.Mock).not.toHaveBeenCalled();
  });
});
