import { renderHook, act, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

// Mock firebase-web before import
jest.mock('@/lib/firebase-web', () => ({
  requestFcmToken: jest.fn(),
}));

import { usePushNotifications } from '../usePushNotifications';
import { requestFcmToken } from '@/lib/firebase-web';

const mockRequestFcmToken = requestFcmToken as jest.Mock;

// Use a local fetch mock to avoid interference from global mock
let mockFetch: jest.Mock;

// Save originals
const originalNotification = (global as any).Notification;

function setupBrowserSupport() {
  Object.defineProperty(window, 'Notification', {
    value: { requestPermission: jest.fn() },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      register: jest.fn(),
      ready: Promise.resolve({ pushManager: {} }),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'PushManager', {
    value: class PushManager {},
    writable: true,
    configurable: true,
  });
}

function removeBrowserSupport() {
  delete (window as any).Notification;
  delete (window as any).PushManager;
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh local mock each test to avoid state leaking
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    setupBrowserSupport();
  });

  afterEach(() => {
    if (originalNotification !== undefined) {
      Object.defineProperty(window, 'Notification', {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('browser support detection', () => {
    it('should set status to unsupported when Notification API is missing', async () => {
      removeBrowserSupport();

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('unsupported');
      });

      expect(result.current.isSupported).toBe(false);
    });

    it('should set isSupported to true when all APIs are available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ hasPushNotifications: true }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.isSupported).toBe(true);
      });
    });
  });

  describe('initial preference fetch', () => {
    it('should set status to enabled when hasPushNotifications is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ hasPushNotifications: true }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('enabled');
      });

      expect(result.current.isSupported).toBe(true);
    });

    it('should set status to disabled when hasPushNotifications is false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });
    });

    it('should set status to disabled when preferences endpoint returns non-ok', async () => {
      mockFetch.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });
    });

    it('should set status to error when preferences fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });

      expect(result.current.error).toBe('Network failure');
    });
  });

  describe('enableOnThisDevice', () => {
    it('should complete the full enable flow successfully', async () => {
      // Initial preferences fetch -> disabled
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('granted');
      (navigator.serviceWorker.register as jest.Mock).mockResolvedValue({ pushManager: {} });
      mockRequestFcmToken.mockResolvedValue('fcm-token-123');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      // Register device
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      // Patch preferences
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('enabled');
      expect(window.Notification.requestPermission).toHaveBeenCalled();
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
        '/firebase-messaging-sw.js'
      );
      expect(mockRequestFcmToken).toHaveBeenCalled();
    });

    it('should set disabled when permission is denied', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('denied');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('disabled');
      expect(result.current.error).toContain('not granted');
    });

    it('should set error when service worker registration fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('granted');
      (navigator.serviceWorker.register as jest.Mock).mockResolvedValue(null);

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('service worker');
    });

    it('should set error when FCM token is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('granted');
      (navigator.serviceWorker.register as jest.Mock).mockResolvedValue({ pushManager: {} });
      mockRequestFcmToken.mockResolvedValue(null);

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('token');
    });

    it('should set error when device registration API fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockResolvedValue('granted');
      (navigator.serviceWorker.register as jest.Mock).mockResolvedValue({ pushManager: {} });
      mockRequestFcmToken.mockResolvedValue('fcm-token');

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      // Register device endpoint fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Server error' }),
      });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('Server error');
    });

    it('should handle thrown error in enable flow', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      (window.Notification.requestPermission as jest.Mock).mockRejectedValue(
        new Error('Permission API broken')
      );

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Permission API broken');
    });

    it('should set unsupported when browser APIs are removed mid-session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      removeBrowserSupport();

      await act(async () => {
        await result.current.enableOnThisDevice();
      });

      expect(result.current.status).toBe('unsupported');
    });
  });

  describe('disableAllDevices', () => {
    it('should PATCH preferences to disable and update status', async () => {
      // Initial fetch: enabled
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: true }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('enabled');
      });

      // Disable PATCH
      mockFetch.mockResolvedValueOnce({ ok: true });

      await act(async () => {
        await result.current.disableAllDevices();
      });

      expect(result.current.status).toBe('disabled');

      // Check the PATCH call
      const patchCall = mockFetch.mock.calls[1];
      expect(patchCall[0]).toBe('/api/notifications/push/preferences');
      expect(patchCall[1].method).toBe('PATCH');
      expect(JSON.parse(patchCall[1].body)).toEqual({
        hasPushNotifications: false,
      });
    });

    it('should set error when disable fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: true }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('enabled');
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.disableAllDevices();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Network error');
    });
  });

  describe('refreshPreferences', () => {
    it('should re-fetch preferences', async () => {
      // Initial fetch: disabled
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: false }),
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current.status).toBe('disabled');
      });

      // Refresh returns enabled
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hasPushNotifications: true }),
      });

      await act(async () => {
        await result.current.refreshPreferences();
      });

      expect(result.current.status).toBe('enabled');
    });
  });
});
