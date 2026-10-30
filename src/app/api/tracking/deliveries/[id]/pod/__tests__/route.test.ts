/**
 * Soft-delete coverage for /api/tracking/deliveries/[id]/pod.
 *
 * Every read and write against `deliveries` must exclude soft-deleted rows
 * (`deleted_at IS NULL`): a deleted delivery must 404 on upload, fetch and
 * delete, and the UPDATEs must never touch a deleted row.
 */

jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/lib/auth/driver-ownership', () => ({ userOwnsDriver: jest.fn() }));
jest.mock('@/utils/supabase/storage', () => ({
  uploadPODImage: jest.fn(),
  deletePODImage: jest.fn(),
}));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }));

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { uploadPODImage, deletePODImage } from '@/utils/supabase/storage';
import { POST, GET, DELETE } from '../route';

const mockedPrisma = jest.mocked(prisma);
const queryRaw = mockedPrisma.$queryRawUnsafe as jest.Mock;
const executeRaw = mockedPrisma.$executeRawUnsafe as jest.Mock;

const DELIVERY_ID = '11111111-1111-1111-1111-111111111111';
const PHOTO_URL = 'https://cdn.example.com/storage/v1/object/public/delivery-proofs/pod/1.jpg';
const params = { params: Promise.resolve({ id: DELIVERY_ID }) };
const url = `http://localhost:3000/api/tracking/deliveries/${DELIVERY_ID}/pod`;

const asAdmin = () =>
  (withAuth as jest.Mock).mockResolvedValue({
    success: true,
    context: { user: { id: 'admin-1', type: 'ADMIN' } },
  });

// The delivery row still exists; only the soft-delete filter can exclude it.
const rowUnlessFiltered = (row: Record<string, unknown>) =>
  queryRaw.mockImplementation((sql: string) =>
    Promise.resolve(sql.includes('deleted_at IS NULL') ? [] : [row])
  );

const postRequest = () => {
  const req = new NextRequest(url, { method: 'POST' });
  (req as any).formData = jest.fn().mockResolvedValue({
    get: (k: string) =>
      k === 'file' ? ({ name: 'pod.jpg', type: 'image/jpeg', size: 1024 } as unknown as File) : null,
  });
  return req;
};

const deliveryUpdate = () =>
  executeRaw.mock.calls.find(
    ([sql]: [string]) => typeof sql === 'string' && /UPDATE deliveries/.test(sql)
  );

describe('/api/tracking/deliveries/[id]/pod — soft-deleted deliveries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asAdmin();
    executeRaw.mockResolvedValue(1);
    (uploadPODImage as jest.Mock).mockResolvedValue({ url: PHOTO_URL, path: 'pod/1.jpg' });
    (deletePODImage as jest.Mock).mockResolvedValue({});
  });

  describe('POST', () => {
    it('returns 404 for a soft-deleted delivery and uploads nothing', async () => {
      rowUnlessFiltered({ id: DELIVERY_ID, driver_id: 'driver-1' });

      const res = await POST(postRequest(), params);

      expect(res.status).toBe(404);
      expect(queryRaw.mock.calls[0][0]).toMatch(/WHERE d\.id = \$1\s+AND d\.deleted_at IS NULL/);
      expect(uploadPODImage).not.toHaveBeenCalled();
      expect(deliveryUpdate()).toBeUndefined();
    });

    it('scopes the photo UPDATE to live deliveries', async () => {
      queryRaw.mockResolvedValue([{ id: DELIVERY_ID, driver_id: 'driver-1' }]);

      const res = await POST(postRequest(), params);

      expect(res.status).toBe(200);
      expect(deliveryUpdate()?.[0]).toMatch(/WHERE id = \$1::uuid\s+AND deleted_at IS NULL/);
    });

    it('returns 404 and removes the uploaded object when the UPDATE matches no row', async () => {
      queryRaw.mockResolvedValue([{ id: DELIVERY_ID, driver_id: 'driver-1' }]);
      executeRaw.mockResolvedValue(0);

      const res = await POST(postRequest(), params);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, error: 'Delivery not found' });
      expect(deletePODImage).toHaveBeenCalledWith('pod/1.jpg');
    });

    it('still returns 404 when the orphan cleanup fails', async () => {
      queryRaw.mockResolvedValue([{ id: DELIVERY_ID, driver_id: 'driver-1' }]);
      executeRaw.mockResolvedValue(0);
      (deletePODImage as jest.Mock).mockResolvedValue({ error: 'storage down' });

      const res = await POST(postRequest(), params);

      expect(res.status).toBe(404);
    });
  });

  describe('GET', () => {
    it('returns 404 for a soft-deleted delivery', async () => {
      rowUnlessFiltered({ id: DELIVERY_ID, delivery_photo_url: PHOTO_URL, driver_id: 'driver-1' });

      const res = await GET(new NextRequest(url), params);

      expect(res.status).toBe(404);
      expect(queryRaw.mock.calls[0][0]).toMatch(/WHERE d\.id = \$1\s+AND d\.deleted_at IS NULL/);
    });
  });

  describe('DELETE', () => {
    it('returns 404 for a soft-deleted delivery and deletes nothing', async () => {
      rowUnlessFiltered({ delivery_photo_url: PHOTO_URL });

      const res = await DELETE(new NextRequest(url, { method: 'DELETE' }), params);

      expect(res.status).toBe(404);
      expect(queryRaw.mock.calls[0][0]).toMatch(/WHERE id = \$1\s+AND deleted_at IS NULL/);
      expect(deletePODImage).not.toHaveBeenCalled();
      expect(deliveryUpdate()).toBeUndefined();
    });

    it('scopes the clearing UPDATE to live deliveries', async () => {
      queryRaw.mockResolvedValue([{ delivery_photo_url: PHOTO_URL }]);

      const res = await DELETE(new NextRequest(url, { method: 'DELETE' }), params);

      expect(res.status).toBe(200);
      expect(deliveryUpdate()?.[0]).toMatch(/WHERE id = \$1::uuid\s+AND deleted_at IS NULL/);
    });

    it('returns 404 when the clearing UPDATE matches no row', async () => {
      queryRaw.mockResolvedValue([{ delivery_photo_url: PHOTO_URL }]);
      executeRaw.mockResolvedValue(0);

      const res = await DELETE(new NextRequest(url, { method: 'DELETE' }), params);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, error: 'Delivery not found' });
    });
  });
});
