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

// Controllable driver-tracking state (the redesigned home pulls shift + active
// deliveries from the tracking context).
let mockTrackingState: {
  isShiftActive: boolean;
  currentShift: { startTime: string } | null;
  activeDeliveries: unknown[];
};
jest.mock('@/contexts/DriverTrackingContext', () => ({
  useDriverTracking: () => mockTrackingState,
}));

// Stub the leaf integrations — each owns its own fetch/context and is tested
// separately. The page test only cares that they're mounted.
jest.mock('@/components/Driver/DriverStatsPanel', () => ({
  DriverStatsPanel: ({ driverId }: { driverId: string }) => (
    <div data-testid="driver-stats-panel">{driverId}</div>
  ),
}));
jest.mock('@/components/Driver/DriverDeliveryList', () => ({
  DriverDeliveryList: () => <div data-testid="driver-delivery-list" />,
}));
jest.mock('@/components/Driver/ui/DriverProfileSheet', () => ({
  DriverProfileSheet: ({ driverName }: { driverName: string }) => (
    <div data-testid="driver-profile-sheet">{driverName}</div>
  ),
}));

const mockProfileResponse = {
  id: 'test-driver-id',
  name: 'John Driver',
  email: 'john.driver@example.com',
  type: 'DRIVER',
};

const mockDriversResponse = {
  success: true,
  data: [{ id: 'driver-123', userId: 'test-driver-id', status: 'ACTIVE' }],
};

function renderDriverHome() {
  return renderPage(<DriverPage />, {
    user: mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' }),
  });
}

describe('DriverPage (redesigned home)', () => {
  beforeEach(() => {
    resetAllPageMocks();
    mockTrackingState = {
      isShiftActive: false,
      currentShift: null,
      activeDeliveries: [],
    };

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/api/profile')) {
        return Promise.resolve(createMockApiResponse(mockProfileResponse));
      }
      if (url.includes('/api/tracking/drivers')) {
        return Promise.resolve(createMockApiResponse(mockDriversResponse));
      }
      return Promise.resolve(createMockApiResponse({}));
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T14:30:00'));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('greets the driver by the name fetched from the profile API', async () => {
      renderDriverHome();

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('Good afternoon');
        expect(heading).toHaveTextContent('John Driver');
      });
    });

    it('shows the off-shift status and the start-shift entry card by default', async () => {
      renderDriverHome();

      await waitFor(() => {
        expect(screen.getByText('Off shift')).toBeInTheDocument();
      });
      expect(screen.getByText('Start shift')).toBeInTheDocument();
      expect(screen.getByText('My deliveries')).toBeInTheDocument();
      expect(screen.getByText('View history')).toBeInTheDocument();
    });

    it('reflects an active shift and the active-delivery count', async () => {
      mockTrackingState = {
        isShiftActive: true,
        currentShift: { startTime: '2024-06-15T13:30:00' },
        activeDeliveries: [{ id: 'd1' }, { id: 'd2' }],
      };
      renderDriverHome();

      await waitFor(() => {
        expect(screen.getByText('On shift')).toBeInTheDocument();
      });
      expect(screen.getByText('Active shift')).toBeInTheDocument();
      expect(screen.getByText('2 active')).toBeInTheDocument();
    });
  });

  describe('navigation entry cards', () => {
    it('links the primary card to live tracking and history card to history', async () => {
      renderDriverHome();

      await waitFor(() => {
        expect(screen.getByText('Start shift')).toBeInTheDocument();
      });

      const trackingLinks = screen.getAllByRole('link', { name: /start shift|active shift/i });
      expect(trackingLinks[0]).toHaveAttribute('href', '/driver/tracking');

      const historyLink = screen.getByRole('link', { name: /view history/i });
      expect(historyLink).toHaveAttribute('href', '/driver/history');
    });
  });

  describe('child integrations', () => {
    it('renders the deliveries list and the stats panel once a driverId resolves', async () => {
      renderDriverHome();

      expect(await screen.findByTestId('driver-delivery-list')).toBeInTheDocument();
      // DriverStatsPanel only mounts after /api/tracking/drivers resolves a driver.
      expect(await screen.findByTestId('driver-stats-panel')).toHaveTextContent('driver-123');
    });
  });

  describe('API calls', () => {
    it('fetches the profile and the driver record on mount', async () => {
      renderDriverHome();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/profile');
      });
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/tracking/drivers?limit=1');
      });
    });
  });

  describe('time-based greeting', () => {
    it.each([
      ['2024-06-15T09:00:00', 'Good morning'],
      ['2024-06-15T14:00:00', 'Good afternoon'],
      ['2024-06-15T18:00:00', 'Good evening'],
    ])('shows the right greeting at %s', async (time, expected) => {
      jest.setSystemTime(new Date(time));
      renderDriverHome();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(expected);
      });
    });
  });

  describe('error handling', () => {
    it('falls back to the default name when the profile fetch fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderDriverHome();

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('Good afternoon');
        expect(heading).toHaveTextContent('Driver');
      });

      consoleSpy.mockRestore();
    });
  });
});
