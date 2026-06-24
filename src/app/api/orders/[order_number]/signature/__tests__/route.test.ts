/**
 * Tests for the pickup-signature POST route. Mirrors the POD route: auth + role
 * + driver-assignment gating, FileUpload (category = 'pickup_signature'), and a
 * non-fatal mirror of the URL onto the standalone `deliveries` row.
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

const SIG_URL = 'https://cdn.example.com/signatures/sig.png';

const makeFile = () =>
  ({ name: 'pickup-signature.png', type: 'image/png', size: 512 } as unknown as File);

const createPostRequest = (orderNumber = 'CAT-001', file: File | null = makeFile()) => {
  const req = new NextRequest(
    `http://localhost:3000/api/orders/${orderNumber}/signature`,
    { method: 'POST' },
  );
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (k: string) => (k === 'file' ? file : null),
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
  });
  (mockedPrisma.onDemand.findFirst as jest.Mock).mockResolvedValue(null);
  (mockedPrisma.dispatch.findFirst as jest.Mock).mockResolvedValue({ id: 'dispatch-1' });
  (mockedPrisma.fileUpload.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (mockedPrisma.fileUpload.create as jest.Mock).mockResolvedValue({ id: 'file-1' });
  (mockedPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

  mockedUpload.mockResolvedValue({ url: SIG_URL, path: 'signatures/sig.png', error: null });
};

const importRoute = async () => import('../route');
const params = (order_number: string) => ({ params: Promise.resolve({ order_number }) });

describe('pickup signature POST', () => {
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

  it('uploads + mirrors the signature URL onto the deliveries row', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBe(SIG_URL);

    expect(mockedPrisma.fileUpload.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'pickup_signature',
          cateringRequestId: 'order-123',
        }),
      }),
    );

    const [sql, urlArg, orderArg] = (mockedPrisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
    expect(sql).toContain('UPDATE deliveries');
    expect(sql).toContain('pickup_signature_url');
    expect(sql).toContain('LOWER(order_number) = LOWER($2)');
    expect(sql).toContain('deleted_at IS NULL');
    expect(urlArg).toBe(SIG_URL);
    expect(orderArg).toBe('CAT-001');
  });

  it('still succeeds when the deliveries mirror throws (non-fatal)', async () => {
    setupMocks();
    (mockedPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('no deliveries row'));
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(mockedSentry.captureException).toHaveBeenCalled();
  });

  it('returns 500 and skips the mirror when the upload fails', async () => {
    setupMocks();
    mockedUpload.mockResolvedValue({ url: null, path: null, error: 'storage down' });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest('CAT-001'), params('CAT-001'));

    expect(res.status).toBe(500);
    expect(mockedPrisma.$executeRawUnsafe as jest.Mock).not.toHaveBeenCalled();
  });
});
