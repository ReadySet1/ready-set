/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import DriverPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  createMockApiResponse,
  resetAllPageMocks,
} from '@/__tests__/utils/page-test-utils';
import { UserType } from '@/types/user';

// Mock DriverStatsCard since it has its own tests
jest.mock('@/components/Driver/DriverStatsCard', () => ({
  DriverStatsCard: () => <div data-testid="driver-stats-card">Stats</div>,
}));

// Mock useDriverStats
jest.mock('@/hooks/tracking/useDriverStats', () => ({
  useDriverStats: () => ({ data: { deliveryStats: { inProgress: 2, completed: 3 } } }),
}));

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

// Mock tracking drivers response
const mockDriversResponse = {
  success: true,
  data: [{ id: 'driver-123' }],
};

describe('DriverPage (Dashboard)', () => {
  beforeEach(() => {
    resetAllPageMocks();

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve(createMockApiResponse(mockProfileResponse));
      }
      if (url.includes('/api/tracking/drivers')) {
        return Promise.resolve(createMockApiResponse(mockDriversResponse));
      }
      return Promise.resolve(createMockApiResponse({}));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the dashboard header', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
      });

      expect(screen.getByText('Driver Dashboard')).toBeInTheDocument();
    });

    it('should display driver greeting with name', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
      });

      await waitFor(() => {
        // The greeting uses the fetched profile name
        expect(screen.getByText(/John Driver/)).toBeInTheDocument();
      });
    });

    it('should render the three action cards', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      expect(screen.getByText('My Deliveries')).toBeInTheDocument();
      expect(screen.getByText('View History')).toBeInTheDocument();
      expect(screen.getByText(/Start Shift|Manage Shift/)).toBeInTheDocument();
    });

    it('should link My Deliveries to /driver/deliveries', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      const deliveriesLink = screen.getByText('My Deliveries').closest('a');
      expect(deliveriesLink).toHaveAttribute('href', '/driver/deliveries');
    });

    it('should link View History to /driver/history', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      const historyLink = screen.getByText('View History').closest('a');
      expect(historyLink).toHaveAttribute('href', '/driver/history');
    });
  });

  describe('API calls', () => {
    it('should fetch driver profile on mount', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/profile');
      });
    });
  });

  describe('error handling', () => {
    it('should handle profile fetch error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/profile')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(createMockApiResponse({}));
      });

      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      // Should still render the dashboard without crashing
      expect(screen.getByText('Driver Dashboard')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
