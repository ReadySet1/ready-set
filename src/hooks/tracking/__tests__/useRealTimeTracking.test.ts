import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealTimeTracking } from '../useRealTimeTracking';

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  readyState: number = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private static instances: MockEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }

  static getLastInstance(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }

  static clearInstances() {
    MockEventSource.instances = [];
  }
}

// Store original EventSource
const OriginalEventSource = global.EventSource;

describe('useRealTimeTracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockEventSource.clearInstances();

    // Mock EventSource
    (global as any).EventSource = MockEventSource;

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as any).EventSource = OriginalEventSource;
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useRealTimeTracking());

      expect(result.current.activeDrivers).toEqual([]);
      expect(result.current.recentLocations).toEqual([]);
      expect(result.current.activeDeliveries).toEqual([]);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should create EventSource connection on mount', () => {
      renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();
      expect(eventSource).toBeDefined();
      expect(eventSource?.url).toBe('/api/tracking/live');
    });

    it('should set isConnected to true when EventSource opens', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBe(null);
    });
  });

  describe('message handling', () => {
    it('should handle connection message', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
        eventSource?.simulateMessage({ type: 'connection' });
      });

      // Connection message doesn't update state, just logs
      expect(result.current.isConnected).toBe(true);
    });

    it('should handle driver_update message', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      const mockData = {
        activeDrivers: [
          {
            id: 'driver-1',
            employeeId: 'EMP001',
            isActive: true,
            isOnDuty: true,
          },
        ],
        recentLocations: [
          {
            driverId: 'driver-1',
            location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            accuracy: 10,
            speed: 5,
            heading: 180,
            isMoving: true,
            activityType: 'driving',
            recordedAt: new Date().toISOString(),
          },
        ],
        activeDeliveries: [
          {
            id: 'delivery-1',
            driverId: 'driver-1',
            status: 'en_route',
          },
        ],
      };

      await act(async () => {
        eventSource?.simulateOpen();
        eventSource?.simulateMessage({ type: 'driver_update', data: mockData });
      });

      expect(result.current.activeDrivers).toEqual(mockData.activeDrivers);
      expect(result.current.recentLocations).toEqual(mockData.recentLocations);
      expect(result.current.activeDeliveries).toEqual(mockData.activeDeliveries);
    });

    it('should handle error message from server', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
        eventSource?.simulateMessage({ type: 'error', message: 'Server error occurred' });
      });

      expect(result.current.error).toBe('Server error occurred');
    });

    it('should handle malformed JSON data gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
        // Simulate raw message with invalid JSON
        eventSource?.onmessage?.(new MessageEvent('message', { data: 'invalid json' }));
      });

      expect(result.current.error).toBe('Error parsing real-time data');
      consoleErrorSpy.mockRestore();
    });

    it('should handle empty data in driver_update', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
        eventSource?.simulateMessage({ type: 'driver_update', data: {} });
      });

      expect(result.current.activeDrivers).toEqual([]);
      expect(result.current.recentLocations).toEqual([]);
      expect(result.current.activeDeliveries).toEqual([]);
    });
  });

  describe('error handling and reconnection', () => {
    it('should set error and isConnected false on connection error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      await act(async () => {
        eventSource?.simulateError();
      });

      expect(result.current.isConnected).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('should attempt reconnection with exponential backoff', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      renderHook(() => useRealTimeTracking());

      const firstEventSource = MockEventSource.getLastInstance();

      // Simulate connection closed
      await act(async () => {
        firstEventSource!.readyState = MockEventSource.CLOSED;
        firstEventSource?.simulateError();
      });

      // First reconnect after 1 second
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(MockEventSource.getLastInstance()).not.toBe(firstEventSource);
      consoleErrorSpy.mockRestore();
    });

    it('should stop reconnecting after max attempts', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useRealTimeTracking());

      // The hook checks attempts >= maxAttempts BEFORE incrementing
      // So we need 6 errors total: 5 to increment counter to 5, then 1 more to trigger the check
      // Simulate 5 failed reconnection attempts (this fills the counter to 5)
      for (let i = 0; i < 5; i++) {
        const eventSource = MockEventSource.getLastInstance();
        await act(async () => {
          eventSource!.readyState = MockEventSource.CLOSED;
          eventSource?.simulateError();
        });

        const delay = 1000 * Math.pow(2, i);
        await act(async () => {
          jest.advanceTimersByTime(delay + 100);
        });
      }

      // 6th error triggers the max attempts check (5 >= 5)
      const eventSource = MockEventSource.getLastInstance();
      await act(async () => {
        eventSource!.readyState = MockEventSource.CLOSED;
        eventSource?.simulateError();
      });

      // After max attempts reached, should show error
      expect(result.current.error).toContain('Connection failed after 5 attempts');
      consoleErrorSpy.mockRestore();
    });

    it('should reset reconnect attempts on successful connection', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      renderHook(() => useRealTimeTracking());

      const firstEventSource = MockEventSource.getLastInstance();

      // Simulate error and reconnect
      await act(async () => {
        firstEventSource!.readyState = MockEventSource.CLOSED;
        firstEventSource?.simulateError();
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const secondEventSource = MockEventSource.getLastInstance();

      // Successful reconnection
      await act(async () => {
        secondEventSource?.simulateOpen();
      });

      // Simulate another error - should start from attempt 1 again
      await act(async () => {
        secondEventSource!.readyState = MockEventSource.CLOSED;
        secondEventSource?.simulateError();
      });

      // Should reconnect after 1 second (not 2 seconds)
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(MockEventSource.getLastInstance()).not.toBe(secondEventSource);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('manual reconnect', () => {
    it('should allow manual reconnection', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const firstEventSource = MockEventSource.getLastInstance();

      await act(async () => {
        firstEventSource?.simulateOpen();
      });

      await act(async () => {
        result.current.reconnect();
      });

      const secondEventSource = MockEventSource.getLastInstance();
      expect(secondEventSource).not.toBe(firstEventSource);
    });

    it('should reset reconnect attempts on manual reconnect', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useRealTimeTracking());

      // Simulate a few failed attempts to increment counter
      for (let i = 0; i < 3; i++) {
        const eventSource = MockEventSource.getLastInstance();
        await act(async () => {
          eventSource!.readyState = MockEventSource.CLOSED;
          eventSource?.simulateError();
        });

        const delay = 1000 * Math.pow(2, i);
        await act(async () => {
          jest.advanceTimersByTime(delay + 100);
        });
      }

      // Manual reconnect should reset attempts counter to 0
      await act(async () => {
        result.current.reconnect();
      });

      // After manual reconnect, we should be able to have 5 more failed attempts
      // without hitting the max attempts error (since counter was reset)
      // Simulate 5 failures followed by 1 more to trigger max check
      for (let i = 0; i < 5; i++) {
        const eventSource = MockEventSource.getLastInstance();
        await act(async () => {
          eventSource!.readyState = MockEventSource.CLOSED;
          eventSource?.simulateError();
        });

        const delay = 1000 * Math.pow(2, i);
        await act(async () => {
          jest.advanceTimersByTime(delay + 100);
        });
      }

      // 6th error after reset triggers max attempts
      const eventSource = MockEventSource.getLastInstance();
      await act(async () => {
        eventSource!.readyState = MockEventSource.CLOSED;
        eventSource?.simulateError();
      });

      // Should now show max attempts error
      expect(result.current.error).toContain('Connection failed after 5 attempts');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('visibility change handling', () => {
    it('should reconnect when page becomes visible and not connected', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const firstEventSource = MockEventSource.getLastInstance();

      // Simulate disconnection
      await act(async () => {
        firstEventSource!.readyState = MockEventSource.CLOSED;
      });

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should attempt to reconnect
      const newEventSource = MockEventSource.getLastInstance();
      expect(newEventSource).not.toBe(firstEventSource);
    });

    it('should not reconnect when page becomes visible and already connected', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const firstEventSource = MockEventSource.getLastInstance();

      await act(async () => {
        firstEventSource?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate page becoming visible
      Object.defineProperty(document, 'hidden', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should not create a new connection
      expect(MockEventSource.getLastInstance()).toBe(firstEventSource);
    });

    it('should handle page becoming hidden', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
      });

      // Simulate page becoming hidden
      Object.defineProperty(document, 'hidden', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Connection should remain (hook doesn't disconnect on hide)
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('health check', () => {
    it('should run health check interval when connected', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);

      // Advance by health check interval (30 seconds)
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      // Health check runs but doesn't change state if no issues
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should close EventSource on unmount', () => {
      const { unmount } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      unmount();

      expect(eventSource?.readyState).toBe(MockEventSource.CLOSED);
    });

    it('should clear reconnect timeout on unmount', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      const { unmount } = renderHook(() => useRealTimeTracking());

      // Trigger a reconnect timeout by simulating an error
      const eventSource = MockEventSource.getLastInstance();
      await act(async () => {
        eventSource!.readyState = MockEventSource.CLOSED;
        eventSource?.simulateError();
      });

      // Now unmount before the timeout fires
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should remove visibility change listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() => useRealTimeTracking());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('multiple driver updates', () => {
    it('should update state correctly with multiple sequential updates', async () => {
      const { result } = renderHook(() => useRealTimeTracking());

      const eventSource = MockEventSource.getLastInstance();

      await act(async () => {
        eventSource?.simulateOpen();
      });

      // First update
      await act(async () => {
        eventSource?.simulateMessage({
          type: 'driver_update',
          data: {
            activeDrivers: [{ id: 'driver-1', employeeId: 'EMP001' }],
            recentLocations: [],
            activeDeliveries: [],
          },
        });
      });

      expect(result.current.activeDrivers).toHaveLength(1);

      // Second update with more drivers
      await act(async () => {
        eventSource?.simulateMessage({
          type: 'driver_update',
          data: {
            activeDrivers: [
              { id: 'driver-1', employeeId: 'EMP001' },
              { id: 'driver-2', employeeId: 'EMP002' },
            ],
            recentLocations: [],
            activeDeliveries: [],
          },
        });
      });

      expect(result.current.activeDrivers).toHaveLength(2);
    });
  });
});
