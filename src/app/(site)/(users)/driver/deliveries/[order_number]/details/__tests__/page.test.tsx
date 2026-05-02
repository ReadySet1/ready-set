/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { useParams } from 'next/navigation';
import OrderDetailsPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  createMockApiResponse,
  resetAllPageMocks,
} from '@/__tests__/utils/page-test-utils';
import { UserType } from '@/types/user';

const mockDelivery = {
  id: 'del-1',
  orderNumber: 'CV-TEST01',
  delivery_type: 'catering',
  status: 'assigned',
  driverStatus: 'EN_ROUTE_TO_VENDOR',
  pickupDateTime: '2026-05-02T10:00:00.000Z',
  arrivalDateTime: '2026-05-02T11:00:00.000Z',
  order_total: '150.00',
  headcount: 25,
  client_attention: 'Ask for John',
  pickupNotes: 'Side entrance',
  specialNotes: 'Handle with care',
  address: { id: 'a1', street1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' },
  delivery_address: { id: 'a2', street1: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78702' },
  createdAt: '2026-05-01T08:00:00.000Z',
  user: { name: 'Jane Client', email: 'jane@example.com' },
};

const mockDeliveriesResponse = {
  deliveries: [mockDelivery],
};

describe('OrderDetailsPage', () => {
  beforeEach(() => {
    resetAllPageMocks();
    (useParams as jest.Mock).mockReturnValue({ order_number: 'CV-TEST01' });

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(createMockApiResponse(mockDeliveriesResponse));
      }
      return Promise.resolve(createMockApiResponse({}));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the order number in the header', async () => {
    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Order #CV-TEST01')).toBeInTheDocument();
    });
  });

  it('should render customer info', async () => {
    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Client')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });

  it('should render both addresses', async () => {
    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Pickup Address')).toBeInTheDocument();
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('456 Oak Ave')).toBeInTheDocument();
    });
  });

  it('should render order specifics', async () => {
    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Order Specifics')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument(); // headcount
      expect(screen.getByText('$150.00')).toBeInTheDocument(); // order_total
      expect(screen.getByText('catering')).toBeInTheDocument(); // delivery_type
    });
  });

  it('should render additional info section', async () => {
    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Additional Info')).toBeInTheDocument();
      expect(screen.getByText('Ask for John')).toBeInTheDocument();
      expect(screen.getByText('Side entrance')).toBeInTheDocument();
      expect(screen.getByText('Handle with care')).toBeInTheDocument();
    });
  });

  it('should show error when delivery not found', async () => {
    (useParams as jest.Mock).mockReturnValue({ order_number: 'NONEXISTENT' });

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(createMockApiResponse({ deliveries: [] }))
    );

    renderPage(<OrderDetailsPage />, {
      user: mockAuthenticatedUser({ role: UserType.DRIVER }),
    });

    await waitFor(() => {
      expect(screen.getByText('Delivery not found')).toBeInTheDocument();
    });
  });
});
