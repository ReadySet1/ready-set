import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTrackingSettings } from '../useTrackingSettings';
import { TRACKING_SETTINGS_DEFAULTS } from '@/types/tracking-settings';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const serverSettings = {
  ...TRACKING_SETTINGS_DEFAULTS,
  arrivalGeofenceRadiusM: 91,
};

describe('useTrackingSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the defaults immediately (placeholder), then server values', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: serverSettings }),
    });

    const { result } = renderHook(() => useTrackingSettings(), {
      wrapper: createWrapper(),
    });

    // Placeholder before the fetch settles — always a full settings object.
    expect(result.current.settings).toEqual(TRACKING_SETTINGS_DEFAULTS);

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.settings).toEqual(serverSettings);
  });

  it('falls back to defaults on a non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useTrackingSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.settings).toEqual(TRACKING_SETTINGS_DEFAULTS);
  });

  it('falls back to defaults on a network error', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useTrackingSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.settings).toEqual(TRACKING_SETTINGS_DEFAULTS);
  });

  it('falls back to defaults when the payload fails schema validation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { arrivalGeofenceRadiusM: 'not-a-number' },
      }),
    });

    const { result } = renderHook(() => useTrackingSettings(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.settings).toEqual(TRACKING_SETTINGS_DEFAULTS);
  });
});
