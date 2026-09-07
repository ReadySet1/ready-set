/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import DriverPage from '../page';
import {
  renderPage,
  mockAuthenticatedUser,
  createMockApiResponse,
  createTestQueryClient,
  resetAllPageMocks,
  PageTestWrapper,
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
// separately. The page test only cares that they're mounted. The stats-panel
// stub stays so the not-rendered assertion below fails loudly if the panel is
// ever mounted on the home screen again.
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
        activeDeliveries: [],
      };
      // The "N active" count now derives from /api/driver-deliveries — the same
      // single source the deliveries list uses — not the tracking context.
      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/profile')) {
          return Promise.resolve(createMockApiResponse(mockProfileResponse));
        }
        if (url.includes('/api/tracking/drivers')) {
          return Promise.resolve(createMockApiResponse(mockDriversResponse));
        }
        if (url.includes('/api/driver-deliveries')) {
          return Promise.resolve(
            createMockApiResponse({
              deliveries: [
                { id: 'd1', completeDateTime: null },
                { id: 'd2', completeDateTime: null },
              ],
            }),
          );
        }
        return Promise.resolve(createMockApiResponse({}));
      });

      renderDriverHome();

      await waitFor(() => {
        expect(screen.getByText('On shift')).toBeInTheDocument();
      });
      expect(screen.getByText('Active shift')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('2 active')).toBeInTheDocument();
      });
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
    it('renders the deliveries list but never the removed Performance stats panel', async () => {
      renderDriverHome();

      expect(await screen.findByTestId('driver-delivery-list')).toBeInTheDocument();
      // The Performance section was removed from the home screen — wait for the
      // mount effects to settle, then assert the panel is NOT rendered.
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/profile');
      });
      expect(screen.queryByTestId('driver-stats-panel')).not.toBeInTheDocument();
    });
  });

  describe('API calls', () => {
    it('fetches the profile on mount without the driver-record lookup', async () => {
      renderDriverHome();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/profile');
      });
      // The driver-record lookup only fed the removed stats panel.
      expect(global.fetch).not.toHaveBeenCalledWith('/api/tracking/drivers?limit=1');
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

  describe('SSR hydration', () => {
    // Regression for GlitchTip READY-SET-WEB-3 (React #418 on /driver): the
    // server renders in UTC, the driver's phone in Pacific time, so the
    // time-of-day greeting differed between the server HTML and the client's
    // first render and React threw a text-content mismatch on every page load.
    it('hydrates without a mismatch when the server clock is in a different time-of-day bucket', async () => {
      const tree = (
        <PageTestWrapper
          userContext={mockAuthenticatedUser({ role: UserType.DRIVER, name: 'John Driver' })}
          queryClient={createTestQueryClient()}
        >
          <DriverPage />
        </PageTestWrapper>
      );

      // Server: 21:31 falls in the "evening" bucket.
      jest.setSystemTime(new Date('2024-06-15T21:31:00'));
      const serverHtml = renderToString(tree);

      const container = document.createElement('div');
      container.innerHTML = serverHtml;
      document.body.appendChild(container);

      // Client: 14:31 falls in the "afternoon" bucket.
      jest.setSystemTime(new Date('2024-06-15T14:31:00'));
      const onRecoverableError = jest.fn();
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(container, tree, { onRecoverableError });
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(container.querySelector('h1')).toHaveTextContent('Good afternoon');
      });

      await act(async () => {
        root?.unmount();
      });
      container.remove();
    });
  });
});
