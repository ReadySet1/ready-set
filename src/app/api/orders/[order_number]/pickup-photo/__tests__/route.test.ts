/**
 * Tests for the pickup-photo POST route (photo of the order at the vendor).
 *
 * Same handler family as the POD route: the FileUpload row (category =
 * 'pickup_photo') is the source of truth the orders PATCH gate reads before
 * allowing PICKED_UP. Unlike the POD route there is no `deliveries` mirror —
 * the row has no pickup-photo column.
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

const mockedPrisma = jest.mocked(prisma);
const mockedCreateClient = jest.mocked(createClient);
const mockedUpload = uploadPODImage as jest.Mock;

const PHOTO_URL = 'https://cdn.example.com/pickup/photo.jpg';

const makeFile = (size = 1024, type = 'image/jpeg') =>
  ({ name: 'pickup.jpg', type, size } as unknown as File);

const createPostRequest = (orderNumber = 'CAT-001', file: File | null = makeFile()) => {
  const req = new NextRequest(`http://localhost:3000/api/orders/${orderNumber}/pickup-photo`, {
    method: 'POST',
  });
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (k: string) => (k === 'file' ? file : null),
  });
  return req;
};

const setupMocks = (opts: { role?: string; assigned?: boolean } = {}) => {
  const role = opts.role ?? 'DRIVER';

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
  (mockedPrisma.dispatch.findFirst as jest.Mock).mockResolvedValue(
    opts.assigned === false ? null : { id: 'dispatch-1' },
  );
  (mockedPrisma.fileUpload.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (mockedPrisma.fileUpload.create as jest.Mock).mockResolvedValue({ id: 'file-1' });
  (mockedPrisma.$executeRawUnsafe as jest.Mock).mockResolvedValue(1);

  mockedUpload.mockResolvedValue({ url: PHOTO_URL, path: 'deliveries/order-123/pickup.jpg', error: null });
};

const importRoute = async () => import('../route');

const post = async (file: File | null = makeFile()) => {
  const { POST } = await importRoute();
  return POST(createPostRequest('CAT-001', file), {
    params: Promise.resolve({ order_number: 'CAT-001' }),
  });
};

describe('pickup-photo POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('stores the photo as a pickup_photo FileUpload linked to the order', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toBe(PHOTO_URL);
    expect(data.fileUploadId).toBe('file-1');

    expect(mockedUpload).toHaveBeenCalledWith(expect.anything(), 'order-123', { stage: 'pickup' });
    expect(mockedPrisma.fileUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'pickup_photo',
          cateringRequestId: 'order-123',
          userId: 'user-1',
          fileUrl: PHOTO_URL,
          isTemporary: false,
        }),
      }),
    );
  });

  it('replaces a previous pickup photo for the same order (and only that category)', async () => {
    await post();

    expect(mockedPrisma.fileUpload.deleteMany).toHaveBeenCalledWith({
      where: { category: 'pickup_photo', cateringRequestId: 'order-123' },
    });
  });

  it('does not touch the deliveries mirror (no column for the pickup photo)', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(mockedPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects a request without a file', async () => {
    const res = await post(null);

    expect(res.status).toBe(400);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('rejects a non-image file', async () => {
    const res = await post(makeFile(1024, 'application/pdf'));

    expect(res.status).toBe(400);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('rejects a driver who is not assigned to the order', async () => {
    setupMocks({ assigned: false });

    const res = await post();

    expect(res.status).toBe(403);
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('rejects roles other than DRIVER / ADMIN / SUPER_ADMIN', async () => {
    setupMocks({ role: 'CLIENT' });

    const res = await post();

    expect(res.status).toBe(403);
  });

  it('surfaces a storage failure as 500 without creating a FileUpload', async () => {
    mockedUpload.mockResolvedValue({ url: '', error: 'bucket down' });

    const res = await post();

    expect(res.status).toBe(500);
    expect(mockedPrisma.fileUpload.create).not.toHaveBeenCalled();
  });
});
