import { renderHook, act, waitFor } from '@testing-library/react';
import { usePODOfflineQueue } from '../usePODOfflineQueue';

// Mock Sentry
jest.mock('@/lib/monitoring/sentry', () => ({
  captureException: jest.fn(),
  addSentryBreadcrumb: jest.fn(),
}));

// Mock POD upload store - define the mock object
const mockPODStore = {
  init: jest.fn(),
  addPODUpload: jest.fn(),
  getUnsyncedUploads: jest.fn(),
  getUnsyncedCount: jest.fn(),
  markAsSynced: jest.fn(),
  incrementSyncAttempts: jest.fn(),
  deleteUpload: jest.fn(),
  clearOldSyncedUploads: jest.fn(),
  storedUploadToFile: jest.fn(),
};

// Use factory function that always returns mockPODStore
jest.mock('@/utils/indexedDB/podUploadStore', () => ({
  getPODUploadStore: () => mockPODStore,
}));

import { captureException, addSentryBreadcrumb } from '@/lib/monitoring/sentry';

describe('usePODOfflineQueue', () => {
  const mockDeliveryId = 'delivery-123';
  const mockOrderNumber = 'ORD-456';
  const mockUploadEndpoint = '/api/upload/pod';
  const mockFile = new File(['test content'], 'proof.jpg', { type: 'image/jpeg' });

  const mockStoredUpload = {
    id: 'pod-123',
    deliveryId: mockDeliveryId,
    orderNumber: mockOrderNumber,
    fileData: new ArrayBuffer(8),
    fileName: 'proof.jpg',
    fileType: 'image/jpeg',
    fileSize: 1024,
    createdAt: new Date().toISOString(),
    synced: false,
    syncAttempts: 0,
    uploadEndpoint: mockUploadEndpoint,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    // Mock fetch for upload endpoint
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/uploaded.jpg' }),
    });

    // Set up mock implementations
    mockPODStore.init.mockResolvedValue(undefined);
    mockPODStore.getUnsyncedCount.mockResolvedValue(0);
    mockPODStore.getUnsyncedUploads.mockResolvedValue([]);
    mockPODStore.addPODUpload.mockResolvedValue('pod-123');
    mockPODStore.markAsSynced.mockResolvedValue(undefined);
    mockPODStore.incrementSyncAttempts.mockResolvedValue(1);
    mockPODStore.deleteUpload.mockResolvedValue(undefined);
    mockPODStore.clearOldSyncedUploads.mockResolvedValue(0);
    mockPODStore.storedUploadToFile.mockImplementation(
      (upload) => new File(['test'], upload.fileName, { type: upload.fileType })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => usePODOfflineQueue());

      expect(result.current.offlineStatus.isOnline).toBe(true);
      expect(result.current.offlineStatus.pendingUploads).toBe(0);
      expect(result.current.offlineStatus.syncInProgress).toBe(false);
      expect(result.current.offlineStatus.lastSync).toBeUndefined();
    });

    it('should initialize IndexedDB store on mount', async () => {
      renderHook(() => usePODOfflineQueue());

      await waitFor(() => {
        expect(mockPODStore.init).toHaveBeenCalled();
      });
    });

    it('should load initial pending count', async () => {
      mockPODStore.getUnsyncedCount.mockResolvedValue(3);

      const { result } = renderHook(() => usePODOfflineQueue());

      await waitFor(() => {
        expect(result.current.offlineStatus.pendingUploads).toBe(3);
      });
    });
  });

  describe('queuePODUpload', () => {
    it('should queue a POD upload successfully', async () => {
      const { result } = renderHook(() => usePODOfflineQueue());

      let uploadId: string;
      await act(async () => {
        uploadId = await result.current.queuePODUpload(
          mockDeliveryId,
          mockOrderNumber,
          mockFile,
          mockUploadEndpoint
        );
      });

      expect(uploadId!).toBe('pod-123');
      expect(mockPODStore.addPODUpload).toHaveBeenCalledWith(
        mockDeliveryId,
        mockOrderNumber,
        mockFile,
        mockUploadEndpoint,
        undefined
      );
      expect(addSentryBreadcrumb).toHaveBeenCalledWith('POD upload queued', expect.any(Object));
    });

    it('should queue with metadata', async () => {
      const { result } = renderHook(() => usePODOfflineQueue());

      const metadata = {
        capturedAt: new Date(),
        compressionApplied: true,
        originalSize: 5000,
      };

      await act(async () => {
        await result.current.queuePODUpload(
          mockDeliveryId,
          mockOrderNumber,
          mockFile,
          mockUploadEndpoint,
          metadata
        );
      });

      expect(mockPODStore.addPODUpload).toHaveBeenCalledWith(
        mockDeliveryId,
        mockOrderNumber,
        mockFile,
        mockUploadEndpoint,
        metadata
      );
    });

    it('should update pending count after queueing', async () => {
      mockPODStore.getUnsyncedCount.mockResolvedValue(1);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.queuePODUpload(
          mockDeliveryId,
          mockOrderNumber,
          mockFile,
          mockUploadEndpoint
        );
      });

      expect(result.current.offlineStatus.pendingUploads).toBe(1);
    });

    it('should handle queue error', async () => {
      mockPODStore.addPODUpload.mockRejectedValue(new Error('Storage full'));

      const { result } = renderHook(() => usePODOfflineQueue());

      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await result.current.queuePODUpload(
            mockDeliveryId,
            mockOrderNumber,
            mockFile,
            mockUploadEndpoint
          );
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe('Storage full');
      expect(captureException).toHaveBeenCalled();
    });
  });

  describe('syncPendingUploads', () => {
    it('should sync pending uploads successfully', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      const { result } = renderHook(() => usePODOfflineQueue());

      let syncResults: any[];
      await act(async () => {
        syncResults = await result.current.syncPendingUploads();
      });

      expect(syncResults!).toHaveLength(1);
      expect(syncResults![0].success).toBe(true);
      expect(syncResults![0].url).toBe('https://example.com/uploaded.jpg');
      expect(mockPODStore.markAsSynced).toHaveBeenCalledWith('pod-123');
    });

    it('should set syncInProgress during sync', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      // After sync completes, syncInProgress should be false
      expect(result.current.offlineStatus.syncInProgress).toBe(false);
    });

    it('should handle upload failure', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => usePODOfflineQueue());

      // Wait for initial mount effects
      await waitFor(() => {
        expect(mockPODStore.init).toHaveBeenCalled();
      });

      let syncResults: any[];
      await act(async () => {
        syncResults = await result.current.syncPendingUploads();
      });

      expect(syncResults!).toHaveLength(1);
      expect(syncResults![0].success).toBe(false);
      expect(syncResults![0].error).toContain('Server error');
      expect(mockPODStore.incrementSyncAttempts).toHaveBeenCalledWith('pod-123');
    });

    it('should delete upload after max attempts', async () => {
      const maxAttemptsUpload = { ...mockStoredUpload, syncAttempts: 9 };
      mockPODStore.getUnsyncedUploads.mockResolvedValue([maxAttemptsUpload]);
      mockPODStore.incrementSyncAttempts.mockResolvedValue(10); // Returns 10 after increment

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      expect(mockPODStore.deleteUpload).toHaveBeenCalledWith('pod-123');
      expect(captureException).toHaveBeenCalled();
    });

    it('should prevent concurrent syncs', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      // Use immediate resolution for this test
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://example.com/uploaded.jpg' }),
      });

      const { result } = renderHook(() => usePODOfflineQueue());

      // Start first sync
      let firstSyncPromise: Promise<any[]>;
      await act(async () => {
        firstSyncPromise = result.current.syncPendingUploads();
        // Try to start second sync immediately - should be blocked
        const secondSyncResults = await result.current.syncPendingUploads();
        // Second sync should return empty array because first is in progress
        expect(secondSyncResults).toEqual([]);
      });

      await act(async () => {
        await firstSyncPromise!;
      });
    });

    it('should update lastSync after sync', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([]);

      const { result } = renderHook(() => usePODOfflineQueue());

      expect(result.current.offlineStatus.lastSync).toBeUndefined();

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      expect(result.current.offlineStatus.lastSync).toBeInstanceOf(Date);
    });

    it('should cleanup old synced uploads after sync', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([]);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      expect(mockPODStore.clearOldSyncedUploads).toHaveBeenCalledWith(7);
    });

    it('should log sync completion', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      expect(addSentryBreadcrumb).toHaveBeenCalledWith('POD sync completed', expect.objectContaining({
        total: 1,
        successful: 1,
        failed: 0,
      }));
    });

    it('should add delay between uploads', async () => {
      const uploads = [
        { ...mockStoredUpload, id: 'pod-1' },
        { ...mockStoredUpload, id: 'pod-2' },
      ];
      mockPODStore.getUnsyncedUploads.mockResolvedValue(uploads);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
        jest.runAllTimers();
      });

      // Should have called setTimeout for delay between uploads
      expect(setTimeoutSpy).toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
    });
  });

  describe('getPendingCount', () => {
    it('should return pending count', async () => {
      mockPODStore.getUnsyncedCount.mockResolvedValue(5);

      const { result } = renderHook(() => usePODOfflineQueue());

      let count: number;
      await act(async () => {
        count = await result.current.getPendingCount();
      });

      expect(count!).toBe(5);
    });

    it('should handle error gracefully', async () => {
      mockPODStore.getUnsyncedCount.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => usePODOfflineQueue());

      let count: number;
      await act(async () => {
        count = await result.current.getPendingCount();
      });

      expect(count!).toBe(0);
    });
  });

  describe('getPendingUploads', () => {
    it('should return pending uploads', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      const { result } = renderHook(() => usePODOfflineQueue());

      let uploads: any[];
      await act(async () => {
        uploads = await result.current.getPendingUploads();
      });

      expect(uploads!).toHaveLength(1);
      expect(uploads![0]).toEqual(mockStoredUpload);
    });

    it('should handle error gracefully', async () => {
      mockPODStore.getUnsyncedUploads.mockRejectedValue(new Error('DB error'));

      const { result } = renderHook(() => usePODOfflineQueue());

      let uploads: any[];
      await act(async () => {
        uploads = await result.current.getPendingUploads();
      });

      expect(uploads!).toEqual([]);
    });
  });

  describe('cancelPendingUpload', () => {
    it('should delete pending upload', async () => {
      mockPODStore.getUnsyncedCount.mockResolvedValue(2);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.cancelPendingUpload('pod-123');
      });

      expect(mockPODStore.deleteUpload).toHaveBeenCalledWith('pod-123');
    });

    it('should update pending count after cancellation', async () => {
      mockPODStore.getUnsyncedCount
        .mockResolvedValueOnce(3) // Initial load
        .mockResolvedValueOnce(2); // After cancellation

      const { result } = renderHook(() => usePODOfflineQueue());

      await waitFor(() => {
        expect(result.current.offlineStatus.pendingUploads).toBe(3);
      });

      await act(async () => {
        await result.current.cancelPendingUpload('pod-123');
      });

      expect(result.current.offlineStatus.pendingUploads).toBe(2);
    });

    it('should propagate deletion error', async () => {
      mockPODStore.deleteUpload.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => usePODOfflineQueue());

      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await result.current.cancelPendingUpload('pod-123');
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError).not.toBeNull();
      expect(thrownError?.message).toBe('Delete failed');
    });
  });

  describe('online/offline handling', () => {
    it('should update online status', async () => {
      const { result } = renderHook(() => usePODOfflineQueue());

      expect(result.current.offlineStatus.isOnline).toBe(true);

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
        writable: true,
      });

      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.offlineStatus.isOnline).toBe(false);
    });

    it('should auto-sync when coming back online', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([mockStoredUpload]);

      const { result } = renderHook(() => usePODOfflineQueue());

      // Go offline
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      // Come back online
      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      // Should trigger sync
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          mockUploadEndpoint,
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('periodic updates', () => {
    it('should periodically check pending count', async () => {
      const { result } = renderHook(() => usePODOfflineQueue());

      // Clear initial calls
      mockPODStore.getUnsyncedCount.mockClear();

      // Advance 30 seconds
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      expect(mockPODStore.getUnsyncedCount).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePODOfflineQueue());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });

    it('should reset syncInProgress ref on unmount', async () => {
      const { unmount } = renderHook(() => usePODOfflineQueue());

      // The hook resets syncInProgressRef on unmount
      // This verifies the cleanup effect runs without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('FormData creation', () => {
    it('should create proper FormData for upload', async () => {
      mockPODStore.getUnsyncedUploads.mockResolvedValue([{
        ...mockStoredUpload,
        metadata: {
          capturedAt: new Date().toISOString(),
          compressionApplied: true,
        },
      }]);

      const { result } = renderHook(() => usePODOfflineQueue());

      await act(async () => {
        await result.current.syncPendingUploads();
      });

      // Check that fetch was called with FormData
      expect(global.fetch).toHaveBeenCalledWith(
        mockUploadEndpoint,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });
});
