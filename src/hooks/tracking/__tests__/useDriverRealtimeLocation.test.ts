import { renderHook, act, waitFor } from '@testing-library/react';
import { useDriverRealtimeLocation } from '../useDriverRealtimeLocation';

// Mock channel subscribe/unsubscribe
const mockChannelSubscribe = jest.fn();
const mockChannelUnsubscribe = jest.fn().mockResolvedValue(undefined);

const mockChannel = {
  subscribe: mockChannelSubscribe,
  unsubscribe: mockChannelUnsubscribe,
};

// Mock realtime module
jest.mock('@/lib/realtime', () => ({
  createDriverLocationChannel: jest.fn(() => mockChannel),
}));

import { createDriverLocationChannel } from '@/lib/realtime';

// Helpers to capture callbacks
let channelCallbacks: {
  onLocationUpdate?: (payload: any) => void;
  onDatabaseInsert?: (record: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
};

describe('useDriverRealtimeLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    channelCallbacks = {};

    mockChannelSubscribe.mockImplementation(async (callbacks: any) => {
      channelCallbacks = callbacks;
      // Simulate immediate connection
      callbacks.onConnect?.();
    });

    mockChannelUnsubscribe.mockResolvedValue(undefined);
  });

  describe('initial state', () => {
    it('should initialize with null location and not connected', async () => {
      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      // Before connection resolves
      expect(result.current.location).toBeNull();
      expect(result.current.error).toBeNull();
      expect(typeof result.current.reconnect).toBe('function');
    });
  });

  describe('connection conditions', () => {
    it('should not connect when driverProfileId is null', () => {
      renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: null })
      );

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });

    it('should not connect when driverProfileId is undefined', () => {
      renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: undefined })
      );

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });

    it('should not connect when enabled is false', () => {
      renderHook(() =>
        useDriverRealtimeLocation({
          driverProfileId: 'driver-1',
          enabled: false,
        })
      );

      expect(createDriverLocationChannel).not.toHaveBeenCalled();
    });
  });

  describe('channel lifecycle', () => {
    it('should create channel and subscribe on mount', async () => {
      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.isConnecting).toBe(false);
    });

    it('should unsubscribe on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      unmount();

      expect(mockChannelUnsubscribe).toHaveBeenCalled();
    });

    it('should call onConnectionChange when connected', async () => {
      const onConnectionChange = jest.fn();

      renderHook(() =>
        useDriverRealtimeLocation({
          driverProfileId: 'driver-1',
          onConnectionChange,
        })
      );

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true);
      });
    });

    it('should handle disconnect callback', async () => {
      const onConnectionChange = jest.fn();

      const { result } = renderHook(() =>
        useDriverRealtimeLocation({
          driverProfileId: 'driver-1',
          onConnectionChange,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate disconnect
      await act(async () => {
        channelCallbacks.onDisconnect?.();
      });

      expect(result.current.isConnected).toBe(false);
      expect(onConnectionChange).toHaveBeenCalledWith(false);
    });
  });

  describe('location updates', () => {
    it('should update location from broadcast payload', async () => {
      const onLocationUpdate = jest.fn();

      const { result } = renderHook(() =>
        useDriverRealtimeLocation({
          driverProfileId: 'driver-1',
          onLocationUpdate,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const payload = {
        driverId: 'driver-1',
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 10,
        speed: 25,
        heading: 180,
        isMoving: true,
        timestamp: '2024-01-15T10:00:00Z',
      };

      await act(async () => {
        channelCallbacks.onLocationUpdate?.(payload);
      });

      expect(result.current.location).not.toBeNull();
      expect(result.current.location?.lat).toBe(37.7749);
      expect(result.current.location?.lng).toBe(-122.4194);
      expect(result.current.location?.accuracy).toBe(10);
      expect(result.current.location?.speed).toBe(25);
      expect(result.current.location?.heading).toBe(180);
      expect(result.current.location?.isMoving).toBe(true);
      expect(onLocationUpdate).toHaveBeenCalled();
    });

    it('should update location from database insert', async () => {
      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const record = {
        driver_id: 'driver-1',
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5,
        speed: 30,
        heading: 90,
        is_moving: true,
        recorded_at: '2024-01-15T10:00:00Z',
      };

      await act(async () => {
        channelCallbacks.onDatabaseInsert?.(record);
      });

      expect(result.current.location).not.toBeNull();
      expect(result.current.location?.lat).toBe(40.7128);
      expect(result.current.location?.lng).toBe(-74.006);
      expect(result.current.location?.accuracy).toBe(5);
    });

    it('should ignore location updates when driverProfileId is cleared', async () => {
      const { result, rerender } = renderHook(
        ({ driverProfileId }: { driverProfileId: string | null }) =>
          useDriverRealtimeLocation({ driverProfileId }),
        { initialProps: { driverProfileId: 'driver-1' as string | null } }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Store the callback before rerender clears the driverIdRef
      const savedCallback = channelCallbacks.onDatabaseInsert;

      // Clear driverProfileId
      rerender({ driverProfileId: null });

      // Try to send a location update
      await act(async () => {
        savedCallback?.({
          driver_id: 'driver-1',
          latitude: 10,
          longitude: 20,
          recorded_at: '2024-01-15T10:00:00Z',
        });
      });

      // Should not update because driverIdRef is null
      expect(result.current.location).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error on channel error callback', async () => {
      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      await act(async () => {
        channelCallbacks.onError?.(new Error('Channel broken'));
      });

      expect(result.current.error).toBe('Channel broken');
      expect(result.current.isConnected).toBe(false);
    });

    it('should set error on subscribe rejection', async () => {
      mockChannelSubscribe.mockRejectedValueOnce(new Error('Subscribe failed'));

      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Subscribe failed');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });
  });

  describe('reconnect', () => {
    it('should reconnect when reconnect function is called', async () => {
      const { result } = renderHook(() =>
        useDriverRealtimeLocation({ driverProfileId: 'driver-1' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      (createDriverLocationChannel as jest.Mock).mockClear();

      await act(async () => {
        result.current.reconnect();
      });

      // Should have unsubscribed the old channel and created a new one
      expect(mockChannelUnsubscribe).toHaveBeenCalled();
      await waitFor(() => {
        expect(createDriverLocationChannel).toHaveBeenCalled();
      });
    });
  });
});
