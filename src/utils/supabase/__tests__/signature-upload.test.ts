jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }));

import { createClient } from '@/utils/supabase/server';
import { uploadPickupSignatureImage } from '../storage';

describe('uploadPickupSignatureImage path per stage', () => {
  const upload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    upload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
    (createClient as jest.Mock).mockResolvedValue({
      storage: {
        from: jest.fn(() => ({
          upload,
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
        })),
      },
    });
  });

  const sig = () => new Blob(['x'], { type: 'image/png' });

  it('keeps the pickup-signature prefix by default', async () => {
    const res = await uploadPickupSignatureImage(sig(), 'order-1');
    expect(res.path).toMatch(/^deliveries\/order-1\/pickup-signature-\d+\.png$/);
  });

  it('uses a delivery-signature prefix for the completion recipient', async () => {
    const res = await uploadPickupSignatureImage(sig(), 'order-1', { stage: 'delivery' });
    expect(res.path).toMatch(/^deliveries\/order-1\/delivery-signature-\d+\.png$/);
  });
});
