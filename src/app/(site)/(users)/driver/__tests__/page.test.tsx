/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import DriverPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  mockLoadingUser,
  createMockApiResponse,
  resetAllPageMocks,
} from '@/__tests__/utils/page-test-utils';
import { UserType } from '@/types/user';

// Mock the useDriverStats hook
jest.mock('@/hooks/tracking/useDriverStats', () => ({
  useDriverStats: jest.fn(() => ({
    data: {
      deliveryStats: {
        inProgress: 3,
        completed: 12,
        total: 15,
      },
      performance: {
        onTimeRate: 95,
        rating: 4.8,
      },
    },
    isLoading: false,
    error: null,
  })),
}));

// Mock DriverDeliveries component to avoid complex setup
jest.mock('@/components/Driver/DriverDeliveries', () => {
  return function MockDriverDeliveries() {
    return <div data-testid="driver-deliveries">Driver Deliveries Component</div>;
  };
});

// Mock DriverStatsCard component
jest.mock('@/components/Driver/DriverStatsCard', () => ({
  DriverStatsCard: () => <div data-testid="driver-stats-card">Driver Stats Card</div>,
}));

// Mock profile and driver API responses
const mockProfileResponse = {
  id: 'test-driver-id',
  name: 'John Driver',
  email: 'john.driver@example.com',
  type: 'DRIVER',
};

const mockDriversResponse = {
  success: true,
  data: [
    {
      id: 'driver-123',
      userId: 'test-driver-id',
      status: 'ACTIVE',
    },
  ],
};

describe('DriverPage', () => {
  beforeEach(() => {
    resetAllPageMocks();

    // Setup fetch mock for API endpoints
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve(createMockApiResponse(mockProfileResponse));
      }
      if (url.includes('/api/tracking/drivers')) {
        return Promise.resolve(createMockApiResponse(mockDriversResponse));
      }
      return Promise.resolve(createMockApiResponse({}));
    });

    // Mock Date to have consistent time for tests
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T14:30:00'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should render dashboard title when driver is authenticated', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
      });

      await waitFor(() => {
        expect(screen.getByText('Driver Dashboard')).toBeInTheDocument();
      });
    });

    it('should render welcome message with driver name', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
      });

      await waitFor(() => {
        // The component fetches the name from API
        expect(screen.getByText(/Good afternoon, John Driver!/)).toBeInTheDocument();
      });
    });

    it('should show ready message', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Ready to make some deliveries today?')).toBeInTheDocument();
      });
    });

    it('should show off shift status by default', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Off Shift')).toBeInTheDocument();
      });
    });
  });

  describe('quick actions', () => {
    it('should have link to start shift/tracking', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('Start Shift')).toBeInTheDocument();
      });

      const trackingLink = screen.getByRole('link', { name: /start shift/i });
      expect(trackingLink).toHaveAttribute('href', '/driver/tracking');
    });

    it('should show my deliveries section', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('My Deliveries')).toBeInTheDocument();
      });
    });

    it('should display pending and complete delivery counts', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText('3 Pending')).toBeInTheDocument();
        expect(screen.getByText('12 Complete')).toBeInTheDocument();
      });
    });
  });

  describe('components', () => {
    it('should render DriverDeliveries component', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByTestId('driver-deliveries')).toBeInTheDocument();
      });
    });

    it('should render DriverStatsCard when driverId is available', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByTestId('driver-stats-card')).toBeInTheDocument();
      });
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

    it('should fetch driver data after profile', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tracking/drivers?limit=1');
      });
    });
  });

  describe('time-based greeting', () => {
    it('should show morning greeting before noon', async () => {
      jest.setSystemTime(new Date('2024-06-15T09:00:00'));

      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText(/Good morning, John Driver!/)).toBeInTheDocument();
      });
    });

    it('should show afternoon greeting between noon and 5pm', async () => {
      jest.setSystemTime(new Date('2024-06-15T14:00:00'));

      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText(/Good afternoon, John Driver!/)).toBeInTheDocument();
      });
    });

    it('should show evening greeting after 5pm', async () => {
      jest.setSystemTime(new Date('2024-06-15T18:00:00'));

      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        expect(screen.getByText(/Good evening, John Driver!/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should handle profile fetch error gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      // Should still render the dashboard without crashing
      await waitFor(() => {
        expect(screen.getByText('Driver Dashboard')).toBeInTheDocument();
      });

      // Should show default driver name
      await waitFor(() => {
        expect(screen.getByText(/Driver!/)).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('shift status indicator', () => {
    it('should display shift status indicator', async () => {
      renderPage(<DriverPage />, {
        user: mockAuthenticatedUser({ role: UserType.DRIVER }),
      });

      await waitFor(() => {
        // The status indicator shows "Off Shift" by default
        expect(screen.getByText('Off Shift')).toBeInTheDocument();
      });
    });
  });
});
