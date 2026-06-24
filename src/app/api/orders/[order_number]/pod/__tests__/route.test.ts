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

const makeFile = () =>
  ({ name: 'pod.jpg', type: 'image/jpeg', size: 1024 } as unknown as File);

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
