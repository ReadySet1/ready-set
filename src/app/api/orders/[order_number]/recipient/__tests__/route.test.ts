/**
 * Tests for the completion recipient-confirmation POST route.
 *
 * Business rule (Gary, 2026-06-01 / 06-22): at completion the driver records
 * the recipient's signature OR, if they refuse to sign, the recipient's name.
 * At least one is required; both are accepted. The name lands on
 * `deliveries.delivery_received_by`, the signature as a FileUpload
 * (category 'delivery_signature') mirrored onto `deliveries.delivery_signature_url`.
 * The orders PATCH gate reads those before allowing COMPLETED.
 */

jest.mock('@/utils/prismaDB');
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/utils/supabase/storage', () => ({
  uploadPickupSignatureImage: jest.fn(),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';
import { uploadPickupSignatureImage } from '@/utils/supabase/storage';

const mockedPrisma = jest.mocked(prisma);
const mockedWithAuth = withAuth as jest.Mock;
const mockedUpload = uploadPickupSignatureImage as jest.Mock;

const SIG_URL = 'https://cdn.example.com/deliveries/order-123/delivery-signature.png';

const makeFile = () =>
  ({ name: 'delivery-signature.png', type: 'image/png', size: 512 } as unknown as File);

const createPostRequest = (
  { file = makeFile(), receivedBy = 'Sam Carter' }: { file?: File | null; receivedBy?: string | null } = {},
  orderNumber = 'CAT-001',
) => {
  const req = new NextRequest(
    `http://localhost:3000/api/orders/${orderNumber}/recipient`,
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

const authAs = (type: string, id = 'user-1') =>
  mockedWithAuth.mockResolvedValue({
    success: true,
    context: { user: { id, email: 'x@example.com', type } },
  });

const setupMocks = () => {
  authAs('DRIVER');
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
    path: 'deliveries/order-123/delivery-signature.png',
    error: undefined,
  });
};

const importRoute = async () => import('../route');
const params = (order_number = 'CAT-001') => ({ params: Promise.resolve({ order_number }) });

describe('completion recipient confirmation POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('authenticates through withAuth with the driver + privileged roles', async () => {
    const { POST } = await importRoute();
    await POST(createPostRequest(), params());
    expect(mockedWithAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        allowedRoles: expect.arrayContaining(['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK']),
      }),
    );
  });

  it('returns the withAuth response when authentication fails', async () => {
    mockedWithAuth.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
      context: {},
    });
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params());
    expect(res.status).toBe(401);
    expect(mockedPrisma.delivery.upsert).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist (soft-deleted orders excluded)', async () => {
    (mockedPrisma.cateringRequest.findFirst as jest.Mock).mockResolvedValue(null);
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({}, 'NOPE'), params('NOPE'));
    expect(res.status).toBe(404);
    expect(mockedPrisma.cateringRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('returns 403 for a driver not assigned to the order', async () => {
    (mockedPrisma.dispatch.findFirst as jest.Mock).mockResolvedValue(null);
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params());
    expect(res.status).toBe(403);
    expect(mockedPrisma.dispatch.findFirst).toHaveBeenCalledWith({
      where: { driverId: 'user-1', cateringRequestId: 'order-123' },
      select: { id: true },
    });
    expect(mockedPrisma.delivery.upsert).not.toHaveBeenCalled();
  });

  it('skips the assignment check for an admin', async () => {
    authAs('ADMIN');
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params());
    expect(res.status).toBe(200);
    expect(mockedPrisma.dispatch.findFirst).not.toHaveBeenCalled();
  });

  it('returns 400 when neither a signature nor a name is provided', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({ file: null, receivedBy: '   ' }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/signature|name/i);
    expect(mockedPrisma.delivery.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when the name is longer than 255 characters', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({ file: null, receivedBy: 'x'.repeat(256) }), params());
    expect(res.status).toBe(400);
  });

  it('persists a name-only confirmation (recipient refused to sign) on deliveries.delivery_received_by', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({ file: null, receivedBy: '  Sam Carter ' }), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.receivedBy).toBe('Sam Carter');
    expect(body.url).toBeNull();
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedPrisma.fileUpload.create).not.toHaveBeenCalled();
    expect(mockedPrisma.delivery.upsert).toHaveBeenCalledWith({
      where: { orderNumber: 'CAT-001' },
      update: { deliveryReceivedBy: 'Sam Carter' },
      create: {
        orderNumber: 'CAT-001',
        deliveryAddress: '123 Client St',
        deliveryReceivedBy: 'Sam Carter',
      },
    });
  });

  it('stores a signature-only confirmation as a delivery_signature upload + mirrored URL', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({ receivedBy: null }), params());

    expect(res.status).toBe(200);
    expect(mockedUpload).toHaveBeenCalledWith(expect.anything(), 'order-123', { stage: 'delivery' });
    expect(mockedPrisma.fileUpload.deleteMany).toHaveBeenCalledWith({
      where: { category: 'delivery_signature', cateringRequestId: 'order-123' },
    });
    expect(mockedPrisma.fileUpload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'delivery_signature',
          fileUrl: SIG_URL,
          cateringRequestId: 'order-123',
        }),
      }),
    );
    expect(mockedPrisma.delivery.upsert).toHaveBeenCalledWith({
      where: { orderNumber: 'CAT-001' },
      update: { deliverySignatureUrl: SIG_URL },
      create: {
        orderNumber: 'CAT-001',
        deliveryAddress: '123 Client St',
        deliverySignatureUrl: SIG_URL,
      },
    });
  });

  it('persists both the name and the signature when both are given', async () => {
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params());

    expect(res.status).toBe(200);
    expect(mockedPrisma.delivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { deliveryReceivedBy: 'Sam Carter', deliverySignatureUrl: SIG_URL },
      }),
    );
  });

  it('fails a name-only confirmation with 500 when the deliveries write fails (it is the gating artifact)', async () => {
    (mockedPrisma.delivery.upsert as jest.Mock).mockRejectedValue(new Error('db down'));
    const { POST } = await importRoute();
    const res = await POST(createPostRequest({ file: null }), params());
    expect(res.status).toBe(500);
  });

  it('keeps a signed confirmation successful when only the deliveries mirror fails', async () => {
    (mockedPrisma.delivery.upsert as jest.Mock).mockRejectedValue(new Error('db down'));
    const { POST } = await importRoute();
    const res = await POST(createPostRequest(), params());
    expect(res.status).toBe(200);
  });

  it('rejects a non-image signature file', async () => {
    const { POST } = await importRoute();
    const res = await POST(
      createPostRequest({ file: { name: 'x.pdf', type: 'application/pdf', size: 10 } as unknown as File }),
      params(),
    );
    expect(res.status).toBe(400);
  });
});
