/**
 * Admin POD gallery: every proof-of-delivery photo per delivery (up to 3,
 * card `delivery-finalize-multi-photo`), signed against the private
 * delivery-proofs bucket — not just the single `deliveries.delivery_photo_url`
 * mirror (which only holds the newest upload).
 */
jest.mock('@/lib/auth-middleware', () => ({ withAuth: jest.fn() }));
jest.mock('@/utils/supabase/storage', () => ({ POD_BUCKET_NAME: 'delivery-proofs' }));
const mockGetBatchSignedUrls = jest.fn();
jest.mock('@/lib/signed-url-cache', () => ({
  getSignedUrlCache: () => ({ getBatchSignedUrls: mockGetBatchSignedUrls }),
}));

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { prisma } from '@/utils/prismaDB';
import { GET } from '../route';

const mockedPrisma = jest.mocked(prisma);

const deliveryRow = (orderNumber: string, photoUrl: string) => ({
  id: `del-${orderNumber}`,
  delivery_id: `del-${orderNumber}`,
  order_number: orderNumber,
  photo_url: photoUrl,
  captured_at: '2026-10-16T18:00:00Z',
  status: 'DELIVERED',
  driver_id: 'drv-1',
  driver_name: 'Jane Driver',
  customer_name: 'Acme',
  delivery_address: '1 Main St',
});

const podFile = (id: string, orderNumber: string, path: string, uploadedAt: string, onDemand = false) => ({
  id,
  fileUrl: `https://public/${path}`,
  filePath: path,
  uploadedAt: new Date(uploadedAt),
  cateringRequest: onDemand ? null : { orderNumber },
  onDemand: onDemand ? { orderNumber } : null,
});

const request = () =>
  new NextRequest('http://localhost:3000/api/tracking/deliveries/pod-gallery?page=1&pageSize=12');

describe('GET /api/tracking/deliveries/pod-gallery — all photos per delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (withAuth as jest.Mock).mockResolvedValue({ success: true, context: { user: { id: 'admin-1' } } });
    (mockedPrisma.$queryRawUnsafe as jest.Mock)
      .mockResolvedValueOnce([
        deliveryRow('CV-1', 'https://public/mirror-1.jpg'),
        deliveryRow('OD-2', 'https://public/mirror-2.jpg'),
      ])
      .mockResolvedValueOnce([{ total: BigInt(2) }]);
    mockGetBatchSignedUrls.mockImplementation(async (_bucket: string, paths: string[]) =>
      new Map(paths.map((p) => [p, `https://signed/${p}`])),
    );
  });

  it('attaches every POD photo of each delivery, oldest first, with signed URLs', async () => {
    (mockedPrisma.fileUpload.findMany as jest.Mock).mockResolvedValue([
      podFile('f1', 'CV-1', 'deliveries/a/1.jpg', '2026-10-16T17:00:00Z'),
      podFile('f2', 'cv-1', 'deliveries/a/2.jpg', '2026-10-16T17:01:00Z'),
      podFile('f3', 'CV-1', 'deliveries/a/3.jpg', '2026-10-16T17:02:00Z'),
      podFile('f4', 'OD-2', 'deliveries/b/1.jpg', '2026-10-16T17:03:00Z', true),
    ]);

    const res = await GET(request());
    expect(res.status).toBe(200);
    const { items } = await res.json();

    expect(items[0].photos.map((p: { id: string; url: string }) => [p.id, p.url])).toEqual([
      ['f1', 'https://signed/deliveries/a/1.jpg'],
      ['f2', 'https://signed/deliveries/a/2.jpg'],
      ['f3', 'https://signed/deliveries/a/3.jpg'],
    ]);
    // The card's lead photo is the first POD photo, signed.
    expect(items[0].photoUrl).toBe('https://signed/deliveries/a/1.jpg');
    expect(items[1].photos).toHaveLength(1);
    expect(mockGetBatchSignedUrls).toHaveBeenCalledWith(
      'delivery-proofs',
      expect.arrayContaining(['deliveries/a/1.jpg', 'deliveries/b/1.jpg']),
      expect.any(Number),
    );

    const where = (mockedPrisma.fileUpload.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.category).toBe('proof_of_delivery');
    expect(JSON.stringify(where)).toContain('CV-1');
    expect(JSON.stringify(where)).toContain('"deletedAt":null');
  });

  it('keeps at most 3 photos per delivery', async () => {
    (mockedPrisma.fileUpload.findMany as jest.Mock).mockResolvedValue(
      ['1', '2', '3', '4'].map((n) =>
        podFile(`f${n}`, 'CV-1', `deliveries/a/${n}.jpg`, `2026-10-16T17:0${n}:00Z`),
      ),
    );

    const { items } = await (await GET(request())).json();

    expect(items[0].photos).toHaveLength(3);
  });

  it('excludes soft-deleted drivers in the JOIN so the delivery still lists as Unknown Driver', async () => {
    (mockedPrisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET(request());
    expect(res.status).toBe(200);

    const joinOn = /LEFT JOIN drivers dr ON d\.driver_id = dr\.id AND dr\.deleted_at IS NULL/;
    const [dataSql] = (mockedPrisma.$queryRawUnsafe as jest.Mock).mock.calls[0];
    const [countSql] = (mockedPrisma.$queryRawUnsafe as jest.Mock).mock.calls[1];
    expect(dataSql).toMatch(/^\s*SELECT\s+d\.id,/);
    expect(dataSql).toMatch(joinOn);
    expect(countSql).toMatch(/SELECT COUNT\(\*\)/);
    expect(countSql).toMatch(joinOn);
    // The filter lives in the ON clause, never in WHERE, so the row is kept.
    expect(dataSql).not.toMatch(/WHERE[\s\S]*dr\.deleted_at/);
    expect(countSql).not.toMatch(/WHERE[\s\S]*dr\.deleted_at/);
  });

  it('falls back to the deliveries mirror URL when the order has no POD rows', async () => {
    (mockedPrisma.fileUpload.findMany as jest.Mock).mockResolvedValue([]);

    const { items } = await (await GET(request())).json();

    expect(items[0].photoUrl).toBe('https://public/mirror-1.jpg');
    expect(items[0].photos).toEqual([
      expect.objectContaining({ url: 'https://public/mirror-1.jpg' }),
    ]);
  });
});
