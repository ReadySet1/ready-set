import { renderHook, act, waitFor } from '@testing-library/react';
import { useDriverShift } from '../useDriverShift';

// Mock the server actions that are STILL used by the hook (break ops).
// The shift start/end/active operations moved to fetch() API routes and are
// asserted via the global.fetch routing mock below.
jest.mock('@/app/actions/tracking/driver-actions', () => ({
  startShiftBreak: jest.fn(),
  endShiftBreak: jest.fn(),
}));

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

import {
  startShiftBreak,
  endShiftBreak,
} from '@/app/actions/tracking/driver-actions';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

const mockStartShiftBreak = startShiftBreak as jest.MockedFunction<typeof startShiftBreak>;
const mockEndShiftBreak = endShiftBreak as jest.MockedFunction<typeof endShiftBreak>;

describe('useDriverShift', () => {
  const mockDriverId = '123e4567-e89b-12d3-a456-426614174000';
  const mockShiftId = 'shift-123';
  const mockBreakId = 'break-456';

  const mockLocation = {
    driverId: mockDriverId,
    coordinates: { lat: 37.7749, lng: -122.4194 },
    accuracy: 10,
    speed: 5,
    heading: 180,
    altitude: 50,
    batteryLevel: 80,
    activityType: 'driving' as const,
    isMoving: true,
    timestamp: new Date(),
  };

  const mockShift = {
    id: mockShiftId,
    driverId: mockDriverId,
    startTime: new Date(),
    endTime: undefined,
    startLocation: { lat: 37.7749, lng: -122.4194 },
    endLocation: undefined,
    totalDistanceMiles: 0,
    deliveryCount: 0,
    status: 'active' as const,
    breaks: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSessionResponse = {
    user: {
      driverId: mockDriverId,
    },
  };

  // --- fetch routing mock -------------------------------------------------
  // The hook now talks to API routes instead of Server Actions. We model each
  // route's response with an overridable handler so individual tests can swap
  // in success/failure/queued responses exactly like they used to with the
  // action mocks (mockGetActiveShift/mockStartDriverShift/mockEndDriverShift).
  type FetchResult = {
    ok: boolean;
    status: number;
    json: () => Promise<any>;
  };

  let sessionResponse: () => FetchResult;
  // Active-shift route: a queue of values mirroring mockResolvedValueOnce(...).
  // Each call dequeues the next; once empty it sticks on the last value.
  let activeShiftQueue: Array<any>;
  let startShiftResult: () => FetchResult | Promise<FetchResult>;
  let endShiftResult: () => FetchResult | Promise<FetchResult>;

  const okJson = (body: any, status = 200): FetchResult => ({
    ok: true,
    status,
    json: async () => body,
  });

  const setActiveShift = (...values: any[]) => {
    activeShiftQueue = values;
  };

  const nextActiveShift = (): any => {
    if (activeShiftQueue.length > 1) {
      return activeShiftQueue.shift();
    }
    return activeShiftQueue[0];
  };

  beforeEach(() => {
    // Reset all mocks to clear implementations AND call history
    jest.resetAllMocks();

    // Defaults — equivalent to the old action defaults.
    sessionResponse = () => okJson(mockSessionResponse);
    setActiveShift(null); // getActiveShift -> null by default
    startShiftResult = () => okJson({ success: true, shiftId: mockShiftId });
    endShiftResult = () => okJson({ success: true });

    global.fetch = jest.fn((input: RequestInfo | URL): Promise<any> => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return Promise.resolve(sessionResponse());
      }
      if (url.includes('/api/tracking/shifts/active')) {
        const value = nextActiveShift();
        // An Error in the queue models the active-shift route itself failing
        // (e.g. the post-end re-sync that loadActiveShift performs).
        if (value instanceof Error) {
          return Promise.reject(value);
        }
        return Promise.resolve(okJson({ success: true, shift: value }));
      }
      if (url.includes('/api/tracking/shifts/start')) {
        return Promise.resolve(startShiftResult());
      }
      if (url.includes('/api/tracking/shifts/end')) {
        return Promise.resolve(endShiftResult());
      }
      return Promise.resolve(okJson({}));
    }) as unknown as typeof fetch;

    // Default implementations for the still-mocked break actions.
    mockStartShiftBreak.mockResolvedValue({ success: true, breakId: mockBreakId });
    mockEndShiftBreak.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with loading state while fetching', () => {
      const { result } = renderHook(() => useDriverShift());

      // On initial render, hook starts loading the active shift
      expect(result.current.currentShift).toBe(null);
      expect(result.current.isShiftActive).toBe(false);
      // Loading is true because loadActiveShift is called on mount
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should load active shift on mount', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/api/tracking/shifts/active?driverId=${mockDriverId}`),
          expect.objectContaining({ credentials: 'include' }),
        );
      });

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should set error if driver ID not found', async () => {
      sessionResponse = () => okJson({ user: {} });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.error).toBe('Driver ID not found');
      });
    });

    it('should handle session fetch error', async () => {
      sessionResponse = () => {
        throw new Error('Network error');
      };

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(captureException).toHaveBeenCalled();
      });
    });
  });

  describe('startShift', () => {
    it('should start a new shift successfully', async () => {
      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // startShift calls the active route to check for existing shift (null),
      // then after success loadActiveShift hits the active route again (mockShift)
      setActiveShift(null, mockShift);

      let success: boolean;
      await act(async () => {
        success = await result.current.startShift(mockLocation);
      });

      expect(success!).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tracking/shifts/start',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      // Verify the request body carries the driver id, location and metadata.
      const startCall = (global.fetch as jest.Mock).mock.calls.find(
        ([u]) => String(u) === '/api/tracking/shifts/start',
      );
      const startBody = JSON.parse(startCall![1].body);
      expect(startBody.driverId).toBe(mockDriverId);
      expect(startBody.location).toBeDefined();
      expect(startBody.metadata).toEqual(
        expect.objectContaining({ startedFromApp: true, appVersion: '2.0.0' }),
      );
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver shift started', expect.any(Object));
    });

    it('should fail if there is already an active shift', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startShift(mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('You already have an active shift');
    });

    it('should fail if driver ID not found', async () => {
      sessionResponse = () => okJson({ user: {} });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startShift(mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Driver ID not found');
    });

    it('should handle server error', async () => {
      startShiftResult = () => okJson({ success: false, error: 'Server error' }, 400);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startShift(mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Server error');
      expect(captureException).toHaveBeenCalled();
    });

    it('should return to loading false after operation completes', async () => {
      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Perform a shift start operation
      setActiveShift(mockShift);

      await act(async () => {
        await result.current.startShift(mockLocation);
      });

      // After operation completes, loading should be false
      expect(result.current.loading).toBe(false);
    });
  });

  describe('endShift', () => {
    it('should end shift successfully', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.endShift(mockShiftId, mockLocation);
      });

      expect(success!).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tracking/shifts/end',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
      const endCall = (global.fetch as jest.Mock).mock.calls.find(
        ([u]) => String(u) === '/api/tracking/shifts/end',
      );
      const endBody = JSON.parse(endCall![1].body);
      expect(endBody.shiftId).toBe(mockShiftId);
      expect(endBody.location).toBeDefined();
      expect(endBody.metadata).toEqual(
        expect.objectContaining({
          endedFromApp: true,
          finalLocation: mockLocation.coordinates,
        }),
      );
      expect(result.current.currentShift).toBe(null);
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver shift ended', { shiftId: mockShiftId });
    });

    it('should handle server error', async () => {
      // Mount loads the active shift; on end-failure the hook re-syncs via
      // loadActiveShift. Model that re-sync also failing (transient outage) so
      // the surfaced end-shift error isn't silently cleared.
      setActiveShift(mockShift, new Error('Cannot end shift'));
      endShiftResult = () => okJson({ success: false, error: 'Cannot end shift' }, 400);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.endShift(mockShiftId, mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Cannot end shift');
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('startBreak', () => {
    it('should start a break successfully', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Update active route to return shift with break
      setActiveShift({
        ...mockShift,
        status: 'paused',
        breaks: [{ id: mockBreakId, shiftId: mockShiftId, startTime: new Date(), breakType: 'meal', createdAt: new Date() }],
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startBreak(mockShiftId, 'meal', mockLocation);
      });

      expect(success!).toBe(true);
      expect(mockStartShiftBreak).toHaveBeenCalledWith(mockShiftId, 'meal', mockLocation);
    });

    it('should use default break type of rest', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      await act(async () => {
        await result.current.startBreak(mockShiftId);
      });

      expect(mockStartShiftBreak).toHaveBeenCalledWith(mockShiftId, 'rest', undefined);
    });

    it('should handle break start failure', async () => {
      setActiveShift(mockShift);
      mockStartShiftBreak.mockResolvedValue({ success: false, error: 'Cannot start break' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.startBreak(mockShiftId, 'rest', mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Cannot start break');
    });
  });

  describe('endBreak', () => {
    it('should end a break successfully', async () => {
      const shiftWithBreak = {
        ...mockShift,
        status: 'paused' as const,
        breaks: [{ id: mockBreakId, shiftId: mockShiftId, startTime: new Date(), breakType: 'rest' as const, createdAt: new Date() }],
      };
      setActiveShift(shiftWithBreak);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(shiftWithBreak);
      });

      // Update active route to return active shift without break
      setActiveShift({ ...mockShift, status: 'active' });

      let success: boolean;
      await act(async () => {
        success = await result.current.endBreak(mockBreakId, mockLocation);
      });

      expect(success!).toBe(true);
      expect(mockEndShiftBreak).toHaveBeenCalledWith(mockBreakId, mockLocation);
    });

    it('should handle break end failure', async () => {
      setActiveShift(mockShift);
      mockEndShiftBreak.mockResolvedValue({ success: false, error: 'Cannot end break' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.endBreak(mockBreakId, mockLocation);
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe('Cannot end break');
    });
  });

  describe('refreshShift', () => {
    it('should refresh shift data', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Update active route to return updated shift
      const updatedShift = { ...mockShift, deliveryCount: 5 };
      setActiveShift(updatedShift);

      await act(async () => {
        await result.current.refreshShift();
      });

      expect(result.current.currentShift).toEqual(updatedShift);
    });
  });

  describe('isShiftActive', () => {
    it('should return true for active shift', async () => {
      setActiveShift({ ...mockShift, status: 'active' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should return true for paused shift', async () => {
      setActiveShift({ ...mockShift, status: 'paused' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should return false for completed shift', async () => {
      setActiveShift({ ...mockShift, status: 'completed' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(false);
      });
    });

    it('should return false when no shift', async () => {
      setActiveShift(null);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isShiftActive).toBe(false);
    });
  });

  describe('periodic refresh', () => {
    it('should have refreshShift function available', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Verify refreshShift function is available and works
      expect(typeof result.current.refreshShift).toBe('function');

      // Clear initial calls
      (global.fetch as jest.Mock).mockClear();

      // Call refresh manually
      await act(async () => {
        await result.current.refreshShift();
      });

      // The active-shift route should have been called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tracking/shifts/active'),
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('visibility change handling', () => {
    it('should refresh when page becomes visible with active shift', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Clear calls from initial load
      (global.fetch as jest.Mock).mockClear();

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should trigger refresh
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/tracking/shifts/active'),
          expect.objectContaining({ credentials: 'include' }),
        );
      });
    });

    it('should not refresh when page is hidden', async () => {
      setActiveShift(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Clear calls from initial load
      (global.fetch as jest.Mock).mockClear();

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not trigger refresh when hidden
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/tracking/shifts/active'),
        expect.anything(),
      );
    });
  });
});
