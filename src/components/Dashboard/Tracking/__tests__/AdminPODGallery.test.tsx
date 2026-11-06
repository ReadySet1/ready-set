import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPODGallery } from '../AdminPODGallery';

jest.mock('@/components/Driver/ProofOfDeliveryViewer', () => ({
  ProofOfDeliveryViewer: ({ photoUrl }: { photoUrl: string }) => (
    <div data-testid="pod-viewer" data-url={photoUrl} />
  ),
}));

const item = (orderNumber: string, urls: string[]) => ({
  id: `del-${orderNumber}`,
  deliveryId: `del-${orderNumber}`,
  orderNumber,
  photoUrl: urls[0],
  photos: urls.map((url, i) => ({ id: `${orderNumber}-${i}`, url, uploadedAt: '2026-10-16T17:00:00Z' })),
  capturedAt: '2026-10-16T18:00:00Z',
  driverName: 'Jane Driver',
  driverId: 'drv-1',
  deliveryStatus: 'DELIVERED',
});

function renderGallery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPODGallery />
    </QueryClientProvider>,
  );
}

describe('AdminPODGallery — every POD photo per delivery', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [item('CV-1', ['https://s/1.jpg', 'https://s/2.jpg', 'https://s/3.jpg']), item('OD-2', ['https://s/4.jpg'])],
          totalItems: 2,
        }),
    }) as unknown as typeof fetch;
  });

  it('renders all photos of each delivery and labels multi-photo cards', async () => {
    renderGallery();

    await waitFor(() => expect(screen.getAllByTestId('pod-viewer')).toHaveLength(4));
    expect(screen.getAllByTestId('pod-viewer').map((el) => el.getAttribute('data-url'))).toEqual([
      'https://s/1.jpg',
      'https://s/2.jpg',
      'https://s/3.jpg',
      'https://s/4.jpg',
    ]);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
  });

  it('still renders items without a photos array (single mirror URL)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [{ ...item('CV-9', ['https://s/9.jpg']), photos: undefined }],
          totalItems: 1,
        }),
    }) as unknown as typeof fetch;
    renderGallery();

    await waitFor(() => expect(screen.getAllByTestId('pod-viewer')).toHaveLength(1));
    expect(screen.getByTestId('pod-viewer')).toHaveAttribute('data-url', 'https://s/9.jpg');
  });
});
