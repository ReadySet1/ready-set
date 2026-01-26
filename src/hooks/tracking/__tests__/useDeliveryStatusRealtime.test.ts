/**
 * Unit tests for useDeliveryStatusRealtime hook
 *
 * Tests real-time delivery status updates for helpdesk, vendor, and client users.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useDeliveryStatusRealtime } from '../useDeliveryStatusRealtime';

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock channel subscribe/unsubscribe
const mockChannelSubscribe = jest.fn();
const mockChannelUnsubscribe = jest.fn().mockResolvedValue(undefined);
const mockChannelOn = jest.fn();

const mockChannel = {
  subscribe: mockChannelSubscribe,
  unsubscribe: mockChannelUnsubscribe,
  on: mockChannelOn,
};

// Mock realtime module
jest.mock('@/lib/realtime', () => ({
  createDriverStatusChannel: jest.fn(() => mockChannel),
  REALTIME_EVENTS: {
    DELIVERY_STATUS_UPDATED: 'delivery:status:updated',
    DELIVERY_STATUS_UPDATE: 'delivery:status',
  },
}));

import toast from 'react-hot-toast';
import { createDriverStatusChannel, REALTIME_EVENTS } from '@/lib/realtime';

// Helper to simulate channel callbacks
let channelCallbacks: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onStatusUpdate?: (payload: unknown) => void;
} = {};

// Helper to capture event listener
let eventListeners: Map<string, (payload: unknown) => void> = new Map();

describe('useDeliveryStatusRealtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    channelCallbacks = {};
    eventListeners.clear();

    mockChannelSubscribe.mockImplementation(async (callbacks) => {
      channelCallbacks = callbacks;
      // Simulate successful connection
      callbacks.onConnect?.();
    });

    mockChannelOn.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      eventListeners.set(eventName, handler);
      return mockChannel; // Return channel for chaining
    });

    mockChannelUnsubscribe.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize with default values', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      expect(result.current.latestStatus).toBe(null);
      expect(result.current.statusByOrder).toBeInstanceOf(Map);
      expect(result.current.statusByOrder.size).toBe(0);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.reconnect).toBe('function');
    });

    it('should not connect when enabled is false', async () => {
      renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id', enabled: false })
      );

      expect(createDriverStatusChannel).not.toHaveBeenCalled();
    });

    it('should initialize channel when enabled', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id', enabled: true })
      );

      await waitFor(() => {
        expect(createDriverStatusChannel).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });
    });
  });

  describe('connection management', () => {
    it('should set isConnected on successful connection', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.isConnecting).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should call onConnectionChange callback when connected', async () => {
      const onConnectionChange = jest.fn();

      renderHook(() =>
        useDeliveryStatusRealtime({
          orderId: 'test-order-id',
          onConnectionChange,
        })
      );

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith(true);
      });
    });

    it('should handle disconnect', async () => {
      const onConnectionChange = jest.fn();

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          orderId: 'test-order-id',
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

    it('should handle connection error', async () => {
      mockChannelSubscribe.mockRejectedValueOnce(new Error('Connection failed'));

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Connection failed');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });

    it('should handle error callback from channel', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate error
      const error = new Error('Channel error');
      await act(async () => {
        channelCallbacks.onError?.(error);
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.error).toBe('Channel error');
    });

    it('should reconnect when reconnect function is called', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Clear previous calls
      (createDriverStatusChannel as jest.Mock).mockClear();

      await act(async () => {
        result.current.reconnect();
      });

      // Should have called unsubscribe and created new channel
      expect(mockChannelUnsubscribe).toHaveBeenCalled();
      await waitFor(() => {
        expect(createDriverStatusChannel).toHaveBeenCalled();
      });
    });
  });

  describe('status updates', () => {
    const createStatusPayload = (overrides: Partial<any> = {}) => ({
      orderId: 'test-order-id',
      orderNumber: 'ORD-001',
      orderType: 'catering',
      driverId: 'driver-123',
      status: 'EN_ROUTE_TO_CLIENT',
      previousStatus: 'PICKED_UP',
      timestamp: new Date().toISOString(),
      driverName: 'John Doe',
      ...overrides,
    });

    it('should handle status update for tracked order', async () => {
      const onStatusUpdate = jest.fn();

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          orderId: 'test-order-id',
          onStatusUpdate,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Get the event listener that was registered
      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);
      expect(handler).toBeDefined();

      const payload = createStatusPayload();

      await act(async () => {
        handler!({ payload });
      });

      expect(result.current.latestStatus).toBeTruthy();
      expect(result.current.latestStatus?.status).toBe('EN_ROUTE_TO_CLIENT');
      expect(result.current.statusByOrder.get('test-order-id')).toBe('EN_ROUTE_TO_CLIENT');
      expect(onStatusUpdate).toHaveBeenCalledWith(payload);
    });

    it('should ignore status updates for non-tracked orders', async () => {
      const onStatusUpdate = jest.fn();

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          orderId: 'test-order-id',
          onStatusUpdate,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);
      expect(handler).toBeDefined();

      // Send update for a different order
      const payload = createStatusPayload({ orderId: 'different-order-id' });

      await act(async () => {
        handler!({ payload });
      });

      expect(result.current.latestStatus).toBe(null);
      expect(result.current.statusByOrder.size).toBe(0);
      expect(onStatusUpdate).not.toHaveBeenCalled();
    });

    it('should track multiple orders with orderIds array', async () => {
      const onStatusUpdate = jest.fn();

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          orderIds: ['order-1', 'order-2', 'order-3'],
          onStatusUpdate,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      // Send updates for tracked orders
      await act(async () => {
        handler!({ payload: createStatusPayload({ orderId: 'order-1', status: 'PICKED_UP' }) });
      });

      await act(async () => {
        handler!({ payload: createStatusPayload({ orderId: 'order-2', status: 'EN_ROUTE_TO_CLIENT' }) });
      });

      // Send update for non-tracked order
      await act(async () => {
        handler!({ payload: createStatusPayload({ orderId: 'order-not-tracked', status: 'COMPLETED' }) });
      });

      expect(result.current.statusByOrder.size).toBe(2);
      expect(result.current.statusByOrder.get('order-1')).toBe('PICKED_UP');
      expect(result.current.statusByOrder.get('order-2')).toBe('EN_ROUTE_TO_CLIENT');
      expect(result.current.statusByOrder.has('order-not-tracked')).toBe(false);
      expect(onStatusUpdate).toHaveBeenCalledTimes(2);
    });

    it('should update statusByOrder map on subsequent updates', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      // First update
      await act(async () => {
        handler!({ payload: createStatusPayload({ status: 'PICKED_UP' }) });
      });

      expect(result.current.statusByOrder.get('test-order-id')).toBe('PICKED_UP');

      // Second update
      await act(async () => {
        handler!({ payload: createStatusPayload({ status: 'EN_ROUTE_TO_CLIENT' }) });
      });

      expect(result.current.statusByOrder.get('test-order-id')).toBe('EN_ROUTE_TO_CLIENT');
      expect(result.current.latestStatus?.status).toBe('EN_ROUTE_TO_CLIENT');
    });
  });

  describe('toast notifications', () => {
    const createStatusPayload = (status: string, orderNumber = 'ORD-001') => ({
      orderId: 'test-order-id',
      orderNumber,
      orderType: 'catering',
      driverId: 'driver-123',
      status,
      timestamp: new Date().toISOString(),
      driverName: 'John Doe',
    });

    it('should show toast notification for status updates by default', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      await act(async () => {
        handler!({ payload: createStatusPayload('EN_ROUTE_TO_CLIENT') });
      });

      // Should call toast (not toast.success for non-completed status)
      expect(toast).toHaveBeenCalled();
    });

    it('should show success toast for COMPLETED status', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      await act(async () => {
        handler!({ payload: createStatusPayload('COMPLETED') });
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it('should not show toast when showNotifications is false', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          orderId: 'test-order-id',
          showNotifications: false,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      await act(async () => {
        handler!({ payload: createStatusPayload('EN_ROUTE_TO_CLIENT') });
      });

      expect(toast).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should include order number in toast message', async () => {
      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      await act(async () => {
        handler!({ payload: createStatusPayload('ARRIVED_AT_VENDOR', 'CAT-12345') });
      });

      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining('CAT-12345'),
        expect.any(Object)
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup channel on unmount', async () => {
      const { unmount } = renderHook(() =>
        useDeliveryStatusRealtime({ orderId: 'test-order-id' })
      );

      await waitFor(() => {
        expect(createDriverStatusChannel).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockChannelUnsubscribe).toHaveBeenCalled();
      });
    });

    it('should cleanup when enabled changes to false', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useDeliveryStatusRealtime({ orderId: 'test-order-id', enabled }),
        { initialProps: { enabled: true } }
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Disable
      rerender({ enabled: false });

      // Reconnect should have been triggered with cleanup
      await waitFor(() => {
        expect(mockChannelUnsubscribe).toHaveBeenCalled();
      });
    });
  });

  describe('all-orders tracking (no filter)', () => {
    it('should track all orders when no orderId or orderIds provided', async () => {
      const onStatusUpdate = jest.fn();

      const { result } = renderHook(() =>
        useDeliveryStatusRealtime({
          onStatusUpdate,
        })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      const handler = eventListeners.get(REALTIME_EVENTS.DELIVERY_STATUS_UPDATED);

      // All updates should be accepted
      await act(async () => {
        handler!({
          payload: {
            orderId: 'any-order-1',
            orderNumber: 'ORD-001',
            orderType: 'catering',
            driverId: 'driver-1',
            status: 'PICKED_UP',
            timestamp: new Date().toISOString(),
          },
        });
      });

      await act(async () => {
        handler!({
          payload: {
            orderId: 'any-order-2',
            orderNumber: 'ORD-002',
            orderType: 'on_demand',
            driverId: 'driver-2',
            status: 'EN_ROUTE_TO_CLIENT',
            timestamp: new Date().toISOString(),
          },
        });
      });

      expect(result.current.statusByOrder.size).toBe(2);
      expect(onStatusUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
