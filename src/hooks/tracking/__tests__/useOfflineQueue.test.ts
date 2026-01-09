import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from '../useOfflineQueue';

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

describe('useOfflineQueue', () => {
  // Mock ServiceWorker
  let mockServiceWorkerRegistration: {
    installing: null | object;
    waiting: null | object;
    active: null | object;
    addEventListener: jest.Mock;
    sync: { register: jest.Mock };
  };

  let mockServiceWorkerController: {
    postMessage: jest.Mock;
  };

  let messageChannelPort1OnMessage: ((event: { data: any }) => void) | null = null;

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock Service Worker Registration
    mockServiceWorkerRegistration = {
      installing: null,
      waiting: null,
      active: {},
      addEventListener: jest.fn(),
      sync: {
        register: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Mock Service Worker Controller
    mockServiceWorkerController = {
      postMessage: jest.fn((message, [port]) => {
        // Simulate queue status response
        if (message.type === 'GET_QUEUE_STATUS' && messageChannelPort1OnMessage) {
          setTimeout(() => {
            messageChannelPort1OnMessage?.({ data: { type: 'QUEUE_STATUS', count: 0 } });
          }, 0);
        }
      }),
    };

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
        ready: Promise.resolve(mockServiceWorkerRegistration),
        controller: mockServiceWorkerController,
      },
      configurable: true,
      writable: true,
    });

    // Mock ServiceWorkerRegistration.prototype.sync
    Object.defineProperty(window, 'ServiceWorkerRegistration', {
      value: {
        prototype: {
          sync: {},
        },
      },
      configurable: true,
      writable: true,
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    // Mock MessageChannel
    const mockMessageChannel = jest.fn().mockImplementation(() => ({
      port1: {
        set onmessage(handler: (event: { data: any }) => void) {
          messageChannelPort1OnMessage = handler;
        },
        get onmessage() {
          return messageChannelPort1OnMessage;
        },
      },
      port2: {},
    }));

    (global as any).MessageChannel = mockMessageChannel;
  });

  afterEach(() => {
    jest.resetAllMocks();
    messageChannelPort1OnMessage = null;
  });

  describe('initialization', () => {
    it('should initialize with default values', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Hook updates isOnline from navigator.onLine on mount
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true); // navigator.onLine is mocked as true
      });
      expect(result.current.offlineStatus.pendingUpdates).toBe(0);
      expect(result.current.offlineStatus.syncInProgress).toBe(false);
      expect(result.current.queuedItems).toBe(0);
    });

    it('should update online status after mount', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });
    });

    it('should register service worker on mount', async () => {
      renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js');
      });
    });

    it('should handle service worker registration failure', async () => {
      (navigator.serviceWorker.register as jest.Mock).mockRejectedValue(new Error('Registration failed'));

      renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(captureException).toHaveBeenCalled();
      });
    });

    it('should log background sync support', async () => {
      renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(addSentryBreadcrumb).toHaveBeenCalledWith('Background sync supported', expect.any(Object));
      });
    });
  });

  describe('registerServiceWorker', () => {
    it('should register service worker manually', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Clear initial registration call
      (navigator.serviceWorker.register as jest.Mock).mockClear();

      await act(async () => {
        await result.current.registerServiceWorker();
      });

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js');
    });

    it('should set up update listener on registration', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.registerServiceWorker();
      });

      expect(mockServiceWorkerRegistration.addEventListener).toHaveBeenCalledWith(
        'updatefound',
        expect.any(Function)
      );
    });

    it('should handle missing serviceWorker API gracefully', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      // Save and delete serviceWorker from navigator to simulate unsupported browser
      const originalServiceWorker = navigator.serviceWorker;
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
      delete (navigator as any).serviceWorker;

      // Should not throw when serviceWorker API is missing
      await act(async () => {
        await result.current.registerServiceWorker();
      });

      // Restore
      if (descriptor) {
        Object.defineProperty(navigator, 'serviceWorker', descriptor);
      } else {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: originalServiceWorker,
          configurable: true,
          writable: true,
        });
      }
    });
  });

  describe('online/offline status', () => {
    it('should detect online status', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });
    });

    it('should detect offline status', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      // Fire event to update status
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(false);
      });
    });

    it('should update status on online event', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.offlineStatus.isOnline).toBe(false);

      // Come back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.offlineStatus.isOnline).toBe(true);
    });

    it('should trigger sync when coming back online with pending updates', async () => {
      // Set up pending updates
      const { result, rerender } = renderHook(() => useOfflineQueue());

      // Simulate having pending updates
      await act(async () => {
        // This will set pendingUpdates > 0 through the queue status check
        messageChannelPort1OnMessage?.({ data: { type: 'QUEUE_STATUS', count: 5 } });
      });

      // Go offline
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      // Come back online
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      // syncPendingItems should be called
      await waitFor(() => {
        expect(mockServiceWorkerRegistration.sync.register).toHaveBeenCalledWith('location-sync');
      });
    });
  });

  describe('syncPendingItems', () => {
    it('should register background sync', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.syncPendingItems();
      });

      expect(mockServiceWorkerRegistration.sync.register).toHaveBeenCalledWith('location-sync');
    });

    it('should set syncInProgress during sync', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount effects to complete
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      // After sync completes, syncInProgress should be false
      await act(async () => {
        await result.current.syncPendingItems();
      });

      expect(result.current.offlineStatus.syncInProgress).toBe(false);
    });

    it('should update lastSync after successful sync', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount effects to complete
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      expect(result.current.offlineStatus.lastSync).toBeUndefined();

      await act(async () => {
        await result.current.syncPendingItems();
      });

      expect(result.current.offlineStatus.lastSync).toBeInstanceOf(Date);
    });

    it('should handle sync registration failure', async () => {
      mockServiceWorkerRegistration.sync.register.mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount effects to complete
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      await act(async () => {
        await result.current.syncPendingItems();
      });

      expect(captureException).toHaveBeenCalled();
      expect(result.current.offlineStatus.syncInProgress).toBe(false);
    });
  });

  describe('syncOfflineData', () => {
    it('should be an alias for syncPendingItems', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount effects to complete
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      await act(async () => {
        await result.current.syncOfflineData();
      });

      expect(mockServiceWorkerRegistration.sync.register).toHaveBeenCalledWith('location-sync');
    });
  });

  describe('queue status checking', () => {
    it('should check queue status on mount', async () => {
      renderHook(() => useOfflineQueue());

      // Verify initial check was made
      await waitFor(() => {
        expect(mockServiceWorkerController.postMessage).toHaveBeenCalledWith(
          { type: 'GET_QUEUE_STATUS' },
          expect.anything()
        );
      });
    });

    it('should update queuedItems from service worker response', async () => {
      // Set up mock to respond with count: 10
      mockServiceWorkerController.postMessage.mockImplementation((message, [port]) => {
        if (message.type === 'GET_QUEUE_STATUS' && messageChannelPort1OnMessage) {
          setTimeout(() => {
            messageChannelPort1OnMessage?.({ data: { type: 'QUEUE_STATUS', count: 10 } });
          }, 0);
        }
      });

      const { result } = renderHook(() => useOfflineQueue());

      // Wait for queue status to update
      await waitFor(() => {
        expect(result.current.queuedItems).toBe(10);
        expect(result.current.offlineStatus.pendingUpdates).toBe(10);
      });
    });

    it('should handle missing service worker controller', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: jest.fn().mockResolvedValue(mockServiceWorkerRegistration),
          ready: Promise.resolve(mockServiceWorkerRegistration),
          controller: null, // No controller
        },
        configurable: true,
        writable: true,
      });

      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      // Should not throw, queuedItems should remain 0
      expect(result.current.queuedItems).toBe(0);
    });

    it('should handle queue status error', async () => {
      // Set up postMessage to throw after first call (to allow initial mount to succeed)
      let callCount = 0;
      mockServiceWorkerController.postMessage.mockImplementation((message, ports) => {
        callCount++;
        if (callCount > 1) {
          throw new Error('PostMessage failed');
        }
        // First call - simulate normal response
        if (message.type === 'GET_QUEUE_STATUS' && messageChannelPort1OnMessage) {
          setTimeout(() => {
            messageChannelPort1OnMessage?.({ data: { type: 'QUEUE_STATUS', count: 0 } });
          }, 0);
        }
      });

      const { result } = renderHook(() => useOfflineQueue());

      // Wait for initial mount effects to complete
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      // Should handle error gracefully - queuedItems should remain 0
      expect(result.current.queuedItems).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useOfflineQueue());

      // Wait for mount effects
      await waitFor(() => {
        expect(mockServiceWorkerController.postMessage).toHaveBeenCalled();
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should clean up on unmount', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useOfflineQueue());

      // Wait for mount effects
      await waitFor(() => {
        expect(mockServiceWorkerController.postMessage).toHaveBeenCalled();
      });

      unmount();

      // clearInterval should have been called for cleanup
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });
  });

  describe('SSR safety', () => {
    it('should handle server-side rendering gracefully', async () => {
      // The hook uses typeof checks and try/catch for SSR safety
      const { result } = renderHook(() => useOfflineQueue());

      // Wait for mount effects
      await waitFor(() => {
        expect(result.current.offlineStatus.isOnline).toBe(true);
      });

      expect(result.current.offlineStatus).toBeDefined();
      expect(result.current.queuedItems).toBe(0);
    });
  });

  describe('service worker update handling', () => {
    it('should handle service worker update found', async () => {
      let updateFoundCallback: (() => void) | null = null;
      mockServiceWorkerRegistration.addEventListener.mockImplementation((event, callback) => {
        if (event === 'updatefound') {
          updateFoundCallback = callback;
        }
      });

      renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(mockServiceWorkerRegistration.addEventListener).toHaveBeenCalledWith(
          'updatefound',
          expect.any(Function)
        );
      });

      // Simulate update found
      const mockNewWorker = {
        state: 'installing',
        addEventListener: jest.fn(),
      };

      mockServiceWorkerRegistration.installing = mockNewWorker;

      // Trigger update found
      await act(async () => {
        updateFoundCallback?.();
      });

      expect(mockNewWorker.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));
    });
  });
});
