/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import DriverDeliveriesPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  createMockApiResponse,
  resetAllPageMocks,
} from '@/__tests__/utils/page-test-utils';
import { UserType } from '@/types/user';

// Mock Supabase client
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: jest.fn().mockResolvedValue({}) },
  }),
}));

// Mock clearAuthCookies
jest.mock('@/utils/auth/cookies', () => ({
  clearAuthCookies: jest.fn(),
}));

// Mock profile API response
const mockProfileResponse = {
  id: 'test-driver-id',
  name: 'John Driver',
  email: 'john.driver@example.com',
  type: 'DRIVER',
  status: 'active',
};

// Mock deliveries API response
const mockDeliveriesResponse = {
  deliveries: [
    {
      id: 'del-1',
      orderNumber: 'CV-TEST01',
      delivery_type: 'catering',
      status: 'assigned',
      driverStatus: 'ASSIGNED',
      pickupDateTime: new Date().toISOString(),
      arrivalDateTime: new Date().toISOString(),
      order_total: '150.00',
      client_attention: 'Test client',
      address: { id: 'a1', street1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' },
      delivery_address: { id: 'a2', street1: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78702' },
      createdAt: new Date().toISOString(),
    },
  ],
  metadata: { historicalDaysLimit: 30 },
};

describe('DriverDeliveriesPage (Queue)', () => {
  beforeEach(() => {
    resetAllPageMocks();

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve(createMockApiResponse(mockProfileResponse));
      }
      if (url.includes('/api/driver-deliveries')) {
        return Promise.resolve(createMockApiResponse(mockDeliveriesResponse));
      }
      return Promise.resolve(createMockApiResponse({}));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the driver queue with driver name', async () => {
      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
      });

      await waitFor(() => {
        expect(screen.getByText('John Driver')).toBeInTheDocument();
      });
    });

    it('should render queue section headers', async () => {
      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Now')).toBeInTheDocument();
        expect(screen.getByText('Up Next')).toBeInTheDocument();
        expect(screen.getByText('Done Today')).toBeInTheDocument();
      });
    });

    it('should show "Driver Queue" subtitle', async () => {
      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Driver Queue')).toBeInTheDocument();
      });
    });
  });

  describe('API calls', () => {
    it('should fetch driver profile on mount', async () => {
      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/profile');
      });
    });

    it('should fetch driver deliveries on mount', async () => {
      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/driver-deliveries?page=1&limit=999');
      });
    });
  });

  describe('error handling', () => {
    it('should show error message when deliveries fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/profile')) {
          return Promise.resolve(createMockApiResponse(mockProfileResponse));
        }
        if (url.includes('/api/driver-deliveries')) {
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
        }
        return Promise.resolve(createMockApiResponse({}));
      });

      renderPage(<DriverDeliveriesPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
