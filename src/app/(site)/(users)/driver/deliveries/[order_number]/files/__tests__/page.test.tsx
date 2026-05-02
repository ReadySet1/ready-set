/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { useParams } from 'next/navigation';
import OrderFilesPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  createMockApiResponse,
  resetAllPageMocks,
} from '@/__tests__/utils/page-test-utils';
import { UserType } from '@/types/user';

// Mock FileUploader since it has its own tests
jest.mock('@/components/Uploader/basic-file-uploader', () => ({
  FileUploader: () => <div data-testid="file-uploader">Upload Widget</div>,
}));

const mockDelivery = {
  id: 'del-1',
  orderNumber: 'CV-TEST01',
  delivery_type: 'catering',
  status: 'assigned',
  driverStatus: 'EN_ROUTE_TO_VENDOR',
  pickupDateTime: '2026-05-02T10:00:00.000Z',
  arrivalDateTime: '2026-05-02T11:00:00.000Z',
  address: { id: 'a1', street1: '123 Main St', city: 'Austin', state: 'TX' },
  createdAt: '2026-05-01T08:00:00.000Z',
};

const mockFiles = [
  {
    id: 'f1',
    fileName: 'invoice.pdf',
    fileUrl: 'https://example.com/invoice.pdf',
    category: 'catering-order',
  },
  {
    id: 'f2',
    fileName: 'photo.jpg',
    fileUrl: 'https://example.com/photo.jpg',
    category: 'delivery-proof',
  },
];

describe('OrderFilesPage', () => {
  beforeEach(() => {
    resetAllPageMocks();
    (useParams as jest.Mock).mockReturnValue({ order_number: 'CV-TEST01' });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(createMockApiResponse({ deliveries: [mockDelivery] }));
      }
      if (url.includes('/api/orders/') && url.includes('/files')) {
        return Promise.resolve(createMockApiResponse({ files: mockFiles }));
      }
      return Promise.resolve(createMockApiResponse({}));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header with order number', async () => {
    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Files — #CV-TEST01')).toBeInTheDocument();
    });
  });

  it('should display existing files', async () => {
    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
      expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    });
  });

  it('should display file categories', async () => {
    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('catering order')).toBeInTheDocument();
      expect(screen.getByText('delivery proof')).toBeInTheDocument();
    });
  });

  it('should render the upload widget', async () => {
    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
    });
  });

  it('should show empty state when no files exist', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(createMockApiResponse({ deliveries: [mockDelivery] }));
      }
      if (url.includes('/api/orders/') && url.includes('/files')) {
        return Promise.resolve(createMockApiResponse({ files: [] }));
      }
      return Promise.resolve(createMockApiResponse({}));
    });

    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('No files attached to this order.')).toBeInTheDocument();
    });
  });

  it('should show error when delivery not found', async () => {
    (useParams as jest.Mock).mockReturnValue({ order_number: 'NONEXISTENT' });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(createMockApiResponse({ deliveries: [] }));
      }
      return Promise.resolve(createMockApiResponse({}));
    });

    renderPage(<OrderFilesPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Delivery not found')).toBeInTheDocument();
    });
  });
});
