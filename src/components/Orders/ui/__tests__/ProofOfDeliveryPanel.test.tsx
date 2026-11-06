import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProofOfDeliveryPanel } from '../ProofOfDeliveryPanel';

jest.mock('@/components/Driver/ProofOfDeliveryViewer', () => ({
  ProofOfDeliveryViewer: ({ photoUrl }: { photoUrl: string }) => (
    <div data-testid="pod-viewer" data-url={photoUrl} />
  ),
}));

const file = (id: string, category: string, uploadedAt: string) => ({
  id,
  category,
  fileUrl: `https://signed/${id}.jpg`,
  uploadedAt: new Date(uploadedAt),
});

describe('ProofOfDeliveryPanel (admin order page)', () => {
  it('shows every proof-of-delivery photo in capture order, ignoring other files', () => {
    render(
      <ProofOfDeliveryPanel
        orderId="order-1"
        orderNumber="CV-1"
        files={[
          // The files route lists newest first.
          file('pod-3', 'proof_of_delivery', '2026-10-16T17:02:00Z'),
          file('menu', 'catering-order', '2026-10-16T09:00:00Z'),
          file('pod-2', 'Proof_Of_Delivery', '2026-10-16T17:01:00Z'),
          file('pickup', 'pickup_photo', '2026-10-16T16:00:00Z'),
          file('pod-1', 'proof_of_delivery', '2026-10-16T17:00:00Z'),
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: /proof of delivery/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('pod-viewer').map((el) => el.getAttribute('data-url'))).toEqual([
      'https://signed/pod-1.jpg',
      'https://signed/pod-2.jpg',
      'https://signed/pod-3.jpg',
    ]);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
  });

  it('renders nothing when the order has no proof-of-delivery photo', () => {
    const { container } = render(
      <ProofOfDeliveryPanel
        orderId="order-1"
        orderNumber="CV-1"
        files={[file('menu', 'catering-order', '2026-10-16T09:00:00Z')]}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
