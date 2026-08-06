import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrackingSettingsTab from '../TrackingSettingsTab';
import { TRACKING_SETTINGS_DEFAULTS } from '@/types/tracking-settings';

jest.mock('react-hot-toast', () => {
  const toast = jest.fn();
  return {
    __esModule: true,
    default: Object.assign(toast, {
      success: jest.fn(),
      error: jest.fn(),
    }),
  };
});

jest.mock('@/hooks/tracking/useTrackingSettings', () => ({
  TRACKING_SETTINGS_QUERY_KEY: ['tracking-settings'],
  useTrackingSettings: jest.fn(),
}));

import toast from 'react-hot-toast';
import { useTrackingSettings } from '@/hooks/tracking/useTrackingSettings';

const mockUseTrackingSettings = useTrackingSettings as jest.Mock;
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<TrackingSettingsTab />, { wrapper: Wrapper });
}

describe('TrackingSettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTrackingSettings.mockReturnValue({
      settings: TRACKING_SETTINGS_DEFAULTS,
      isLoaded: true,
      isServerData: true,
    });
  });

  it('renders stored metric values in imperial units (150 m → 492 ft)', () => {
    renderTab();
    expect(screen.getByLabelText(/arrival geofence radius/i)).toHaveValue(492);
    // 100 m accuracy → 328 ft; 300 s stale → 5 min.
    expect(screen.getByLabelText(/gps accuracy filter/i)).toHaveValue(328);
    expect(screen.getByLabelText(/driver offline threshold/i)).toHaveValue(5);
    // Never renders a metric unit label.
    expect(screen.queryByText(/^m$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^km$/)).not.toBeInTheDocument();
  });

  it('saves feet back as meters via PUT', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    renderTab();

    fireEvent.change(screen.getByLabelText(/arrival geofence radius/i), {
      target: { value: '300' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tracking/settings');
    expect(options.method).toBe('PUT');
    const body = JSON.parse(options.body);
    expect(body.arrivalGeofenceRadiusM).toBe(91); // 300 ft ≈ 91 m
    await waitFor(() =>
      expect((toast as unknown as { success: jest.Mock }).success).toHaveBeenCalled(),
    );
  });

  it('blocks saving out-of-bounds values with a field error', async () => {
    renderTab();

    fireEvent.change(screen.getByLabelText(/arrival geofence radius/i), {
      target: { value: '10' }, // below the 50 ft display minimum
    });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect((toast as unknown as { error: jest.Mock }).error).toHaveBeenCalled(),
    );
    expect(mockFetch).not.toHaveBeenCalled();
    // Error messages speak the form's display units, never metric bounds.
    expect(screen.getByText(/between 50 and 5280 ft/i)).toBeInTheDocument();
  });

  it('blocks saving when a field is blanked (never coerces empty to 0)', async () => {
    renderTab();

    fireEvent.change(screen.getByLabelText(/end-shift pickup guard/i), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect((toast as unknown as { error: jest.Mock }).error).toHaveBeenCalled(),
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a value/i)).toBeInTheDocument();
  });

  it('shows an error toast when the server rejects the save', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, error: 'Forbidden' }),
    });
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() =>
      expect((toast as unknown as { error: jest.Mock }).error).toHaveBeenCalledWith(
        'Forbidden',
      ),
    );
  });

  it('fails closed when settings did not come from the server (no editable form)', () => {
    mockUseTrackingSettings.mockReturnValue({
      settings: TRACKING_SETTINGS_DEFAULTS,
      isLoaded: true,
      isServerData: false,
    });
    renderTab();
    // No inputs seeded from fail-open defaults — a retry state instead.
    expect(screen.queryByLabelText(/arrival geofence radius/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save settings/i })).not.toBeInTheDocument();
  });

  it('reset fills the form with defaults without saving', () => {
    mockUseTrackingSettings.mockReturnValue({
      settings: { ...TRACKING_SETTINGS_DEFAULTS, arrivalGeofenceRadiusM: 91 },
      isLoaded: true,
      isServerData: true,
    });
    renderTab();
    expect(screen.getByLabelText(/arrival geofence radius/i)).toHaveValue(299);

    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(screen.getByLabelText(/arrival geofence radius/i)).toHaveValue(492);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
