import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import {
  useDriverStats,
  useDriverStatsSummary,
  driverStatsKeys,
} from '../useDriverStats';
import { createClient } from '@/utils/supabase/client';

const mockFetch = global.fetch as jest.Mock;
const mockCreateClient = createClient as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const mockStatsData = {
  deliveryStats: { total: 25, completed: 20, cancelled: 5 },
  distanceStats: { totalMiles: 150.5 },
  earningsStats: { totalEarnings: 350 },
};

const mockSummaryData = {
  totalActiveDrivers: 10,
  aggregates: { totalDeliveries: 200, totalMiles: 5000 },
};

describe('useDriverStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
        getSession: jest.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-token' } },
          error: null,
        }),
      },
    });
  });

  describe('query key structure', () => {
    it('should use correct query key with driverId and period', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStatsData, meta: { cachedAt: null, freshUntil: null } }),
      });

      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc', period: 'week' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toBe('/api/drivers/driver-abc/stats?period=week');
    });

    it('should default period to today', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStatsData, meta: { cachedAt: null, freshUntil: null } }),
      });

      renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchUrl = mockFetch.mock.calls[0][0] as string;
      expect(fetchUrl).toContain('period=today');
    });
  });

  describe('enabled conditions', () => {
    it('should not fetch when driverId is empty', () => {
      const { result } = renderHook(
        () => useDriverStats({ driverId: '' }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc', enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('successful fetch', () => {
    it('should return driver stats on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockStatsData,
          meta: { cachedAt: null, freshUntil: null },
        }),
      });

      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStatsData);
      expect(result.current.error).toBeNull();
    });

    it('should include auth credentials in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockStatsData,
          meta: { cachedAt: null, freshUntil: null },
        }),
      });

      renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw when user is not authenticated', async () => {
      mockCreateClient.mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
          }),
        },
      });

      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Authentication required');
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Driver not found' }),
      });

      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Driver not found');
    });

    it('should throw when API returns success: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'Invalid period',
          meta: { cachedAt: null, freshUntil: null },
        }),
      });

      const { result } = renderHook(
        () => useDriverStats({ driverId: 'driver-abc' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Invalid period');
    });
  });
});

describe('useDriverStatsSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'admin-user-id' } },
          error: null,
        }),
      },
    });
  });

  it('should fetch summary stats with correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSummaryData,
        meta: { cachedAt: null, freshUntil: null },
      }),
    });

    renderHook(() => useDriverStatsSummary({ period: 'week', includeInactive: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('period=week');
    expect(fetchUrl).toContain('includeInactive=true');
  });

  it('should return summary data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSummaryData,
        meta: { cachedAt: null, freshUntil: null },
      }),
    });

    const { result } = renderHook(() => useDriverStatsSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockSummaryData);
  });

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useDriverStatsSummary({ enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('driverStatsKeys', () => {
  it('should generate correct all key', () => {
    expect(driverStatsKeys.all).toEqual(['driver-stats']);
  });

  it('should generate correct driver key', () => {
    expect(driverStatsKeys.driver('driver-123')).toEqual([
      'driver-stats',
      'driver-123',
    ]);
  });

  it('should generate correct driverPeriod key', () => {
    expect(driverStatsKeys.driverPeriod('driver-123', 'week')).toEqual([
      'driver-stats',
      'driver-123',
      'week',
    ]);
  });

  it('should generate correct summary key', () => {
    expect(driverStatsKeys.summary('month', false)).toEqual([
      'driver-stats-summary',
      'month',
      false,
    ]);
  });
});
