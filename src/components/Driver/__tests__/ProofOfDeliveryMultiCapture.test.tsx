/**
 * Multi-photo proof of delivery (card `delivery-finalize-multi-photo`):
 * the completion flow takes 1–3 photos, shows thumbnails with a count, lets
 * the driver remove one before submitting, and uploads them one per request
 * (the server caps the order at 3 and answers 409 POD_PHOTO_LIMIT beyond it).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProofOfDeliveryCapture } from '../ProofOfDeliveryCapture';
import { revokeImagePreviewUrl } from '@/lib/utils/image-compression';

const mockQueuePODUpload = jest.fn();
let mockIsOnline = true;

jest.mock('@/hooks/useCameraPermission', () => ({
  useCameraPermission: jest.fn(() => ({
    permission: 'prompt',
    requestPermission: jest.fn(),
    error: null,
    isCameraSupported: true,
  })),
  isMobileDevice: jest.fn(() => true),
}));

jest.mock('@/hooks/tracking/usePODOfflineQueue', () => ({
  usePODOfflineQueue: jest.fn(() => ({
    offlineStatus: { isOnline: mockIsOnline, pendingUploads: 0 },
    queuePODUpload: mockQueuePODUpload,
    syncPendingUploads: jest.fn(),
  })),
}));

jest.mock('@/lib/auth/bearer-session', () => ({
  withBearerAuth: jest.fn(async () => ({ Authorization: 'Bearer tok' })),
}));

let previewCounter = 0;
jest.mock('@/lib/utils/image-compression', () => ({
  compressImage: jest.fn(async (file: File) => ({
    file,
    originalSize: file.size,
    compressedSize: file.size,
    compressionRatio: 1,
  })),
  createImagePreviewUrl: jest.fn(() => `blob:preview-${++previewCounter}`),
  revokeImagePreviewUrl: jest.fn(),
  formatFileSize: jest.fn((size: number) => `${size} B`),
  generatePODFilename: jest.fn((id: string) => `pod-${id}.jpg`),
  POD_PHOTO_TOO_LARGE_ERROR: 'Photo too large to upload — try again',
}));

const ENDPOINT = '/api/orders/CV-1/pod';

const okResponse = (url: string) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ success: true, url }),
});

const errorResponse = (status: number, body: Record<string, unknown>) => ({
  ok: false,
  status,
  statusText: 'Error',
  json: () => Promise.resolve(body),
});

function renderCapture(overrides: Partial<React.ComponentProps<typeof ProofOfDeliveryCapture>> = {}) {
  const props = {
    deliveryId: 'order-1',
    orderNumber: 'CV-1',
    isRequired: true,
    maxPhotos: 3,
    uploadEndpoint: ENDPOINT,
    onUploadComplete: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  };
  render(<ProofOfDeliveryCapture {...props} />);
  return props;
}

const input = () => screen.getByLabelText('Capture photo') as HTMLInputElement;

async function addPhoto(name: string) {
  const file = new File(['x'], name, { type: 'image/jpeg' });
  await act(async () => {
    fireEvent.change(input(), { target: { files: [file] } });
  });
  return file;
}

const uploadButton = () => screen.getByRole('button', { name: /upload \d photo/i });

describe('ProofOfDeliveryCapture — multi-photo mode (maxPhotos > 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    previewCounter = 0;
    mockIsOnline = true;
    global.fetch = jest.fn();
  });

  it('starts empty: shows "0 of 3" and blocks submitting until one photo is added', () => {
    renderCapture();

    expect(screen.getByText('0 of 3 photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload 0 photos/i })).toBeDisabled();
  });

  it('opens the camera synchronously from the tap (iOS user-activation constraint)', () => {
    const click = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    renderCapture();

    fireEvent.click(screen.getByRole('button', { name: /add photo/i }));

    // Called inside the same tick as the tap — no await before the click.
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('adds photos as thumbnails with a running count, up to the cap', async () => {
    renderCapture();

    await addPhoto('a.jpg');
    expect(screen.getByText('1 of 3 photos')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Proof of delivery photo 1' })).toHaveAttribute(
      'src',
      'blob:preview-1',
    );

    await addPhoto('b.jpg');
    await addPhoto('c.jpg');
    expect(screen.getByText('3 of 3 photos')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /proof of delivery photo/i })).toHaveLength(3);
    // At the cap the add tile disappears.
    expect(screen.queryByRole('button', { name: /add photo/i })).not.toBeInTheDocument();
  });

  it('ignores a photo picked beyond the cap', async () => {
    renderCapture({ maxPhotos: 2 });
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');
    await addPhoto('c.jpg');

    expect(screen.getByText('2 of 2 photos')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /proof of delivery photo/i })).toHaveLength(2);
  });

  it('removes a photo before submitting and frees its preview URL', async () => {
    renderCapture();
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));

    expect(screen.getByText('1 of 3 photos')).toBeInTheDocument();
    expect(revokeImagePreviewUrl).toHaveBeenCalledWith('blob:preview-1');
    expect(screen.getByRole('img', { name: 'Proof of delivery photo 1' })).toHaveAttribute(
      'src',
      'blob:preview-2',
    );
    expect(screen.getByRole('button', { name: /add photo/i })).toBeInTheDocument();
  });

  it('uploads every photo, one request each, then reports all URLs', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okResponse('https://cdn/1.jpg'))
      .mockResolvedValueOnce(okResponse('https://cdn/2.jpg'));
    const props = renderCapture();
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');

    fireEvent.click(uploadButton());

    await waitFor(() => expect(props.onUploadComplete).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(ENDPOINT);
    expect(init).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(((init.body as FormData).get('file') as File).name).toBe('pod-order-1.jpg');
    expect(props.onUploadComplete).toHaveBeenCalledWith(
      'https://cdn/1.jpg',
      expect.objectContaining({ deliveryId: 'order-1' }),
      ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
    );
  });

  it('on a server error keeps the uploaded photos and retries only the rest', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okResponse('https://cdn/1.jpg'))
      .mockResolvedValueOnce(errorResponse(500, { error: 'storage down' }))
      .mockResolvedValueOnce(okResponse('https://cdn/2.jpg'));
    const props = renderCapture();
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');

    fireEvent.click(uploadButton());

    expect(await screen.findByText(/storage down/)).toBeInTheDocument();
    expect(props.onUploadComplete).not.toHaveBeenCalled();
    // The uploaded photo can no longer be removed (it is on the server).
    expect(screen.queryByRole('button', { name: 'Remove photo 1' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(props.onUploadComplete).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(props.onUploadComplete).toHaveBeenCalledWith(
      'https://cdn/1.jpg',
      expect.anything(),
      ['https://cdn/1.jpg', 'https://cdn/2.jpg'],
    );
  });

  it('surfaces the server cap (409 POD_PHOTO_LIMIT) and lets the driver continue', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      errorResponse(409, {
        code: 'POD_PHOTO_LIMIT',
        error: 'Proof of delivery is limited to 3 photos per order.',
      }),
    );
    const props = renderCapture();
    await addPhoto('a.jpg');

    fireEvent.click(uploadButton());

    expect(
      await screen.findByText(/limited to 3 photos per order/),
    ).toBeInTheDocument();
    // Re-sending would hit the same cap — no retry / queue, just continue.
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload photos later/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(props.onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it('offline: queues every photo for background upload and lets completion proceed', async () => {
    mockIsOnline = false;
    mockQueuePODUpload.mockResolvedValue('queued-id');
    const props = renderCapture();
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');

    fireEvent.click(uploadButton());

    await waitFor(() => expect(props.onUploadComplete).toHaveBeenCalledTimes(1));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockQueuePODUpload).toHaveBeenCalledTimes(2);
    expect(mockQueuePODUpload).toHaveBeenCalledWith(
      'order-1',
      'CV-1',
      expect.any(File),
      ENDPOINT,
      expect.objectContaining({ compressionApplied: true }),
    );
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
  });

  it('a network failure mid-way queues the photos not yet uploaded', async () => {
    mockQueuePODUpload.mockResolvedValue('queued-id');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okResponse('https://cdn/1.jpg'))
      .mockRejectedValueOnce(new TypeError('Load failed'));
    const props = renderCapture();
    await addPhoto('a.jpg');
    await addPhoto('b.jpg');

    fireEvent.click(uploadButton());

    await waitFor(() => expect(props.onUploadComplete).toHaveBeenCalledTimes(1));
    expect(mockQueuePODUpload).toHaveBeenCalledTimes(1);
  });

  it('when not required, offers Skip while no photo is added', () => {
    const props = renderCapture({ isRequired: false });

    fireEvent.click(screen.getByRole('button', { name: /skip photo/i }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
