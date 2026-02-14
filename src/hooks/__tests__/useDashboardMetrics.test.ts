import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import { useDashboardMetrics } from '../useDashboardMetrics';
import type { DashboardMetrics, DashboardMetricsError } from '@/types/dashboard';

const mockFetch = global.fetch as jest.Mock;
const mockUseSearchParams = useSearchParams as jest.Mock;

const mockMetrics: DashboardMetrics = {
  totalRevenue: 50000,
  deliveriesRequests: 120,
  salesTotal: 95,
  totalVendors: 15,
};

const mockErrorResponse: DashboardMetricsError = {
  error: 'Unauthorized',
  details: 'Session expired',
};

describe('useDashboardMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('should start with loading state', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useDashboardMetrics());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.lastFetchTime).toBeNull();
  });

  it('should fetch metrics on mount with correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    const { result } = renderHook(() => useDashboardMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/dashboard-metrics',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
    expect(result.current.data).toEqual(mockMetrics);
    expect(result.current.lastFetchTime).toBeInstanceOf(Date);
  });

  it('should append search params to URL', async () => {
    const params = new URLSearchParams();
    params.set('startDate', '2024-01-01');
    params.set('endDate', '2024-01-31');
    params.set('vendorId', 'vendor-123');
    mockUseSearchParams.mockReturnValue(params);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    renderHook(() => useDashboardMetrics());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('startDate=2024-01-01');
    expect(fetchUrl).toContain('endDate=2024-01-31');
    expect(fetchUrl).toContain('vendorId=vendor-123');
  });

  it('should call onSuccess callback on successful fetch', async () => {
    const onSuccess = jest.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    renderHook(() => useDashboardMetrics({ onSuccess }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockMetrics);
    });
  });

  it('should handle non-ok response as error', async () => {
    const onError = jest.fn();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => mockErrorResponse,
    });

    const { result } = renderHook(() => useDashboardMetrics({ onError }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(mockErrorResponse);
    expect(result.current.data).toBeNull();
    expect(onError).toHaveBeenCalledWith(mockErrorResponse);
  });

  it('should handle network failure with error object', async () => {
    const onError = jest.fn();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDashboardMetrics({ onError }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({
      error: 'Failed to fetch dashboard metrics',
      details: 'Network error',
    });
    expect(onError).toHaveBeenCalled();
  });

  it('should handle DashboardMetricsError format in response body', async () => {
    const onError = jest.fn();
    const dashboardError: DashboardMetricsError = {
      error: 'Invalid date range',
      details: 'Start date must be before end date',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => dashboardError,
    });

    const { result } = renderHook(() => useDashboardMetrics({ onError }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(dashboardError);
    expect(onError).toHaveBeenCalledWith(dashboardError);
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useDashboardMetrics({ enabled: false })
    );

    // Give it time to potentially fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true); // stays loading since no fetch
  });

  it('should set up refresh interval when specified', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    });

    renderHook(() =>
      useDashboardMetrics({ refreshInterval: 30000 })
    );

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Advance timer by 30s
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('should not set up refresh interval when enabled is false', async () => {
    jest.useFakeTimers();

    renderHook(() =>
      useDashboardMetrics({ refreshInterval: 30000, enabled: false })
    );

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(mockFetch).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should set isRefreshing during manual refetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    const { result } = renderHook(() => useDashboardMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Set up next fetch to be slow
    let resolveFetch: (value: any) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => mockMetrics,
      });
    });

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false);
    });
  });

  it('should clear interval on unmount', async () => {
    jest.useFakeTimers();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    });

    const { unmount } = renderHook(() =>
      useDashboardMetrics({ refreshInterval: 30000 })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should still be 1 call (no additional calls after unmount)
    expect(mockFetch).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should handle non-Error thrown in catch', async () => {
    mockFetch.mockRejectedValueOnce('string error');

    const { result } = renderHook(() => useDashboardMetrics());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({
      error: 'Failed to fetch dashboard metrics',
      details: 'Unknown error',
    });
  });
});
