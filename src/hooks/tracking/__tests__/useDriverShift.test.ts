import { renderHook, act, waitFor } from '@testing-library/react';
import { useDriverShift } from '../useDriverShift';

// Mock the server actions
jest.mock('@/app/actions/tracking/driver-actions', () => ({
  startDriverShift: jest.fn(),
  endDriverShift: jest.fn(),
  getActiveShift: jest.fn(),
  startShiftBreak: jest.fn(),
  endShiftBreak: jest.fn(),
}));

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

import {
  startDriverShift,
  endDriverShift,
  getActiveShift,
  startShiftBreak,
  endShiftBreak,
} from '@/app/actions/tracking/driver-actions';
import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

const mockStartDriverShift = startDriverShift as jest.MockedFunction<typeof startDriverShift>;
const mockEndDriverShift = endDriverShift as jest.MockedFunction<typeof endDriverShift>;
const mockGetActiveShift = getActiveShift as jest.MockedFunction<typeof getActiveShift>;
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

  beforeEach(() => {
    // Reset all mocks to clear implementations AND call history
    jest.resetAllMocks();

    // Mock fetch for session
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSessionResponse),
    });

    // Default mock implementations - these get set after resetAllMocks
    mockGetActiveShift.mockResolvedValue(null);
    mockStartDriverShift.mockResolvedValue({ success: true, shiftId: mockShiftId });
    mockEndDriverShift.mockResolvedValue({ success: true });
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
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(mockGetActiveShift).toHaveBeenCalledWith(mockDriverId);
      });

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should set error if driver ID not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.error).toBe('Driver ID not found');
      });
    });

    it('should handle session fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

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

      // startShift calls getActiveShift to check for existing shift (should return null),
      // then after success calls loadActiveShift which calls getActiveShift again (return mockShift)
      mockGetActiveShift.mockResolvedValueOnce(null).mockResolvedValue(mockShift);

      let success: boolean;
      await act(async () => {
        success = await result.current.startShift(mockLocation);
      });

      expect(success!).toBe(true);
      expect(mockStartDriverShift).toHaveBeenCalledWith(
        mockDriverId,
        mockLocation,
        expect.objectContaining({
          startedFromApp: true,
          appVersion: '2.0.0',
        })
      );
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver shift started', expect.any(Object));
    });

    it('should fail if there is already an active shift', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);

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
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: {} }),
      });

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
      mockStartDriverShift.mockResolvedValue({ success: false, error: 'Server error' });

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
      mockGetActiveShift.mockResolvedValue(mockShift);

      await act(async () => {
        await result.current.startShift(mockLocation);
      });

      // After operation completes, loading should be false
      expect(result.current.loading).toBe(false);
    });
  });

  describe('endShift', () => {
    it('should end shift successfully', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      let success: boolean;
      await act(async () => {
        success = await result.current.endShift(mockShiftId, mockLocation);
      });

      expect(success!).toBe(true);
      expect(mockEndDriverShift).toHaveBeenCalledWith(
        mockShiftId,
        mockLocation,
        undefined,
        expect.objectContaining({
          endedFromApp: true,
          finalLocation: mockLocation.coordinates,
        })
      );
      expect(result.current.currentShift).toBe(null);
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('Driver shift ended', { shiftId: mockShiftId });
    });

    it('should handle server error', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);
      mockEndDriverShift.mockResolvedValue({ success: false, error: 'Cannot end shift' });

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
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Update mock to return shift with break
      mockGetActiveShift.mockResolvedValue({
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
      mockGetActiveShift.mockResolvedValue(mockShift);

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
      mockGetActiveShift.mockResolvedValue(mockShift);
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
      mockGetActiveShift.mockResolvedValue(shiftWithBreak);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(shiftWithBreak);
      });

      // Update mock to return active shift without break
      mockGetActiveShift.mockResolvedValue({ ...mockShift, status: 'active' });

      let success: boolean;
      await act(async () => {
        success = await result.current.endBreak(mockBreakId, mockLocation);
      });

      expect(success!).toBe(true);
      expect(mockEndShiftBreak).toHaveBeenCalledWith(mockBreakId, mockLocation);
    });

    it('should handle break end failure', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);
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
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Update mock to return updated shift
      const updatedShift = { ...mockShift, deliveryCount: 5 };
      mockGetActiveShift.mockResolvedValue(updatedShift);

      await act(async () => {
        await result.current.refreshShift();
      });

      expect(result.current.currentShift).toEqual(updatedShift);
    });
  });

  describe('isShiftActive', () => {
    it('should return true for active shift', async () => {
      mockGetActiveShift.mockResolvedValue({ ...mockShift, status: 'active' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should return true for paused shift', async () => {
      mockGetActiveShift.mockResolvedValue({ ...mockShift, status: 'paused' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(true);
      });
    });

    it('should return false for completed shift', async () => {
      mockGetActiveShift.mockResolvedValue({ ...mockShift, status: 'completed' });

      const { result } = renderHook(() => useDriverShift());

      await waitFor(() => {
        expect(result.current.isShiftActive).toBe(false);
      });
    });

    it('should return false when no shift', async () => {
      mockGetActiveShift.mockResolvedValue(null);

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
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Verify refreshShift function is available and works
      expect(typeof result.current.refreshShift).toBe('function');

      // Clear initial calls
      mockGetActiveShift.mockClear();

      // Call refresh manually
      await act(async () => {
        await result.current.refreshShift();
      });

      // getActiveShift should have been called
      expect(mockGetActiveShift).toHaveBeenCalled();
    });
  });

  describe('visibility change handling', () => {
    it('should refresh when page becomes visible with active shift', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Clear calls from initial load
      mockGetActiveShift.mockClear();

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
        expect(mockGetActiveShift).toHaveBeenCalled();
      });
    });

    it('should not refresh when page is hidden', async () => {
      mockGetActiveShift.mockResolvedValue(mockShift);

      const { result } = renderHook(() => useDriverShift());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.currentShift).toEqual(mockShift);
      });

      // Clear calls from initial load
      mockGetActiveShift.mockClear();

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
      expect(mockGetActiveShift).not.toHaveBeenCalled();
    });
  });
});
