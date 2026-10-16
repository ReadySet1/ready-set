/**
 * Regression tests for the POD (proof-of-delivery) POST route.
 *
 * Headline fix: after creating the FileUpload, the route mirrors the photo URL
 * onto the standalone `deliveries` row via a raw UPDATE so the admin tracking
 * map + POD gallery (which read delivery_photo_url) stay in sync. The mirror is
 * non-fatal — a failing UPDATE must not fail the upload.
 */

jest.mock('@/utils/prismaDB');
jest.mock('@/utils/supabase/server');
jest.mock('@/utils/supabase/storage', () => ({
  uploadPODImage: jest.fn(),
  deletePODImage: jest.fn(),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { createClient } from '@/utils/supabase/server';
import { uploadPODImage } from '@/utils/supabase/storage';
import * as Sentry from '@sentry/nextjs';

const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedUpload = uploadPODImage as jest.Mock;
const mockedSentry = Sentry as unknown as { captureException: jest.Mock };

const PHOTO_URL = 'https://cdn.example.com/pod/photo.jpg';

const makeFile = (size = 1024) =>
  ({ name: 'pod.jpg', type: 'image/jpeg', size } as unknown as File);

const createPostRequest = (orderNumber = 'CAT-001', file: File | null = makeFile()) => {
  const req = new NextRequest(`http://localhost:3000/api/orders/${orderNumber}/pod`, {
    method: 'POST',
  });
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (k: string) => (k === 'file' ? file : null),
  });
  return req;
};

const setupMocks = (opts: { role?: string } = {}) => {
  const role = opts.role ?? 'ADMIN';

  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
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
  (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(0);
  (mockedPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

  mockedUpload.mockResolvedValue({ url: PHOTO_URL, path: 'pod/photo.jpg', error: null });
};

const importRoute = async () => import('../route');

describe('POD POST — deliveries mirror regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('mirrors the photo URL onto the deliveries row (case-insensitive, soft-delete aware)', async () => {
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    expect(res.status).toBe(200);
    expect(mockedPrisma.$executeRawUnsafe as jest.Mock).toHaveBeenCalledTimes(1);
    const [sql, urlArg, orderArg] = (mockedPrisma.$executeRawUnsafe as jest.Mock).mock.calls[0];
    expect(sql).toContain('UPDATE deliveries');
    expect(sql).toContain('delivery_photo_url');
    expect(sql).toContain('LOWER(order_number) = LOWER($2)');
    expect(sql).toContain('deleted_at IS NULL');
    // Bound params: the uploaded URL and the order number.
    expect(urlArg).toBe(PHOTO_URL);
    expect(orderArg).toBe('CAT-001');
  });

  it('still succeeds when the deliveries mirror UPDATE throws (non-fatal)', async () => {
    setupMocks();
    (mockedPrisma.$executeRawUnsafe as jest.Mock).mockRejectedValue(new Error('no deliveries row'));
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    // The FileUpload is the source of truth — the mirror failure is swallowed.
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBe(PHOTO_URL);
    // Failure is reported to Sentry, not surfaced to the client.
    expect(mockedSentry.captureException).toHaveBeenCalled();
  });

  describe('upload size gate (4MB boundary)', () => {
    // Field bug 2026-08-11: client compression is best-effort, so a phone photo
    // "compressed to about 2MB" straddled the old exact 2MB cap. The server cap
    // is now 4MB (safe under Vercel's ~4.5MB body limit) as the suspenders to
    // the client's tighter compression belt.
    const FOUR_MB = 4 * 1024 * 1024;

    it('accepts a file just under the 4MB cap', async () => {
      const { POST } = await importRoute();

      const res = await POST(createPostRequest('CAT-001', makeFile(FOUR_MB - 1)), {
        params: Promise.resolve({ order_number: 'CAT-001' }),
      });

      expect(res.status).toBe(200);
      expect(mockedUpload).toHaveBeenCalled();
    });

    it('rejects a file over the 4MB cap without touching storage', async () => {
      const { POST } = await importRoute();

      const res = await POST(createPostRequest('CAT-001', makeFile(FOUR_MB + 1)), {
        params: Promise.resolve({ order_number: 'CAT-001' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('4MB');
      expect(mockedUpload).not.toHaveBeenCalled();
    });
  });

  describe('Bearer token identity (stale-cookie transport)', () => {
    // 2026-08 field failure: iOS Safari let the auth cookies go stale while
    // the JS session stayed valid — the route must accept the Bearer token
    // even when cookie auth resolves no user.
    const bearerOnlyGetUser = () =>
      jest.fn(async (token?: string) =>
        token === 'tok-123'
          ? { data: { user: { id: 'user-1' } }, error: null }
          : { data: { user: null }, error: { message: 'no cookie session' } },
      );

    it('POST resolves the user from the Authorization header when cookies are stale', async () => {
      const getUser = bearerOnlyGetUser();
      mockedCreateClient.mockResolvedValue({ auth: { getUser } } as any);

      const req = new NextRequest('http://localhost:3000/api/orders/CAT-001/pod', {
        method: 'POST',
        headers: { authorization: 'Bearer tok-123' },
      });
      (req as any).formData = jest.fn().mockResolvedValue({
        get: (k: string) => (k === 'file' ? makeFile() : null),
      });

      const { POST } = await importRoute();
      const res = await POST(req, { params: Promise.resolve({ order_number: 'CAT-001' }) });

      expect(res.status).toBe(200);
      expect(getUser).toHaveBeenCalledWith('tok-123');
    });

    it('GET resolves the user from the Authorization header when cookies are stale', async () => {
      const getUser = bearerOnlyGetUser();
      mockedCreateClient.mockResolvedValue({ auth: { getUser } } as any);
      (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-123',
        orderNumber: 'CAT-001',
        fileUploads: [],
      });

      const req = new NextRequest('http://localhost:3000/api/orders/CAT-001/pod', {
        method: 'GET',
        headers: { authorization: 'Bearer tok-123' },
      });

      const { GET } = await importRoute();
      const res = await GET(req, { params: Promise.resolve({ order_number: 'CAT-001' }) });

      expect(res.status).toBe(200);
      expect(getUser).toHaveBeenCalledWith('tok-123');
    });

    it('POST still authenticates via cookies when no Authorization header is sent', async () => {
      const { POST } = await importRoute();
      const res = await POST(createPostRequest('CAT-001'), {
        params: Promise.resolve({ order_number: 'CAT-001' }),
      });
      expect(res.status).toBe(200);
    });
  });

  it('does not run the mirror when the upload itself fails', async () => {
    setupMocks();
    mockedUpload.mockResolvedValue({ url: null, path: null, error: 'storage down' });
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), {
      params: Promise.resolve({ order_number: 'CAT-001' }),
    });

    expect(res.status).toBe(500);
    expect(mockedPrisma.$executeRawUnsafe as jest.Mock).not.toHaveBeenCalled();
  });
});

describe('POD POST — up to 3 photos per order (delivery-finalize-multi-photo)', () => {
  const ctx = { params: Promise.resolve({ order_number: 'CAT-001' }) };

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks({ role: 'DRIVER' });
  });

  it('appends the photo instead of replacing the ones already on the order', async () => {
    (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(1);
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), ctx);

    expect(res.status).toBe(200);
    expect(mockedPrisma.fileUpload.deleteMany).not.toHaveBeenCalled();
    expect(mockedPrisma.fileUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'proof_of_delivery',
          cateringRequestId: 'order-123',
        }),
      }),
    );
    const data = await res.json();
    expect(data.photoCount).toBe(2);
    expect(data.maxPhotos).toBe(3);
  });

  it('accepts the third photo', async () => {
    (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(2);
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), ctx);

    expect(res.status).toBe(200);
    expect(mockedPrisma.fileUpload.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a 4th photo with 409 POD_PHOTO_LIMIT before touching storage', async () => {
    (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(3);
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), ctx);

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data).toEqual(
      expect.objectContaining({ success: false, code: 'POD_PHOTO_LIMIT', maxPhotos: 3 }),
    );
    expect(data.error).toMatch(/3 photos/);
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedPrisma.fileUpload.create).not.toHaveBeenCalled();
  });

  it('counts only this order\'s proof-of-delivery photos', async () => {
    (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(0);
    const { POST } = await importRoute();

    await POST(createPostRequest('CAT-001'), ctx);

    expect(mockedPrisma.fileUpload.count).toHaveBeenCalledWith({
      where: { category: 'proof_of_delivery', cateringRequestId: 'order-123' },
    });
  });

  it('re-checks the cap under a row lock and discards the stored file when a concurrent upload won the last slot', async () => {
    // Pre-check sees 2 (room for one) but a parallel request lands first, so
    // the locked re-count inside the transaction sees 3.
    (mockedPrisma.fileUpload.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    const { deletePODImage } = jest.requireMock('@/utils/supabase/storage');
    (deletePODImage as jest.Mock).mockResolvedValue({ error: null });
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), ctx);

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('POD_PHOTO_LIMIT');
    expect(mockedPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'order-123',
    );
    expect(mockedPrisma.fileUpload.create).not.toHaveBeenCalled();
    expect(deletePODImage).toHaveBeenCalledWith('pod/photo.jpg');
  });

  it('applies the cap to admins too (the 3-photo limit is a data invariant)', async () => {
    setupMocks({ role: 'ADMIN' });
    (mockedPrisma.fileUpload.count as jest.Mock).mockResolvedValue(3);
    const { POST } = await importRoute();

    const res = await POST(createPostRequest('CAT-001'), ctx);

    expect(res.status).toBe(409);
  });
});

describe('POD GET — returns every photo on the order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks({ role: 'DRIVER' });
  });

  it('lists all proof-of-delivery photos oldest first', async () => {
    (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'order-123',
      orderNumber: 'CAT-001',
      fileUploads: [
        { id: 'f1', fileUrl: 'https://cdn/1.jpg', uploadedAt: new Date('2026-10-16T10:00:00Z') },
        { id: 'f2', fileUrl: 'https://cdn/2.jpg', uploadedAt: new Date('2026-10-16T10:01:00Z') },
      ],
    });
    const { GET } = await importRoute();

    const res = await GET(
      new NextRequest('http://localhost:3000/api/orders/CAT-001/pod', { method: 'GET' }),
      { params: Promise.resolve({ order_number: 'CAT-001' }) },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasPhoto).toBe(true);
    expect(data.url).toBe('https://cdn/1.jpg');
    expect(data.photos.map((p: { url: string }) => p.url)).toEqual([
      'https://cdn/1.jpg',
      'https://cdn/2.jpg',
    ]);
    const findArgs = (mockedPrisma.cateringRequest.findFirst as jest.Mock).mock.calls[0][0];
    expect(findArgs.include.fileUploads).toEqual(
      expect.objectContaining({ orderBy: { uploadedAt: 'asc' }, take: 3 }),
    );
  });
});
