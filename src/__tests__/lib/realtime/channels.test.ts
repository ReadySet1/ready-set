/**
 * Unit tests for Realtime Channel Classes
 */

import {
  DriverLocationChannel,
  DriverStatusChannel,
  AdminCommandsChannel,
  createDriverLocationChannel,
  createDriverStatusChannel,
  createAdminCommandsChannel,
} from '@/lib/realtime/channels';
import { RealtimeClient } from '@/lib/realtime/client';
import {
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  type DriverLocationPayload,
  type DriverLocationUpdatedPayload,
  type DriverStatusPayload,
  type DriverStatusUpdatedPayload,
  type DeliveryAssignmentPayload,
  type DeliveryAssignedPayload,
  type AdminMessagePayload,
  type AdminMessageReceivedPayload,
  type PresenceState,
} from '@/lib/realtime/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Mock the RealtimeClient
jest.mock('@/lib/realtime/client', () => ({
  RealtimeClient: {
    getInstance: jest.fn(),
  },
  getRealtimeClient: jest.fn(),
}));

/**
 * TODO: REA-211 - Realtime channel tests have Supabase mocking issues
 */
describe.skip('Channel Classes', () => {
  let mockClient: jest.Mocked<RealtimeClient>;
  let mockRealtimeChannel: jest.Mocked<RealtimeChannel>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Realtime channel
    mockRealtimeChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      presenceState: jest.fn().mockReturnValue({}),
    } as any;

    // Create mock RealtimeClient
    mockClient = {
      subscribe: jest.fn().mockResolvedValue(mockRealtimeChannel),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn().mockResolvedValue(undefined),
      trackPresence: jest.fn().mockResolvedValue(undefined),
      untrackPresence: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      getChannel: jest.fn().mockReturnValue(mockRealtimeChannel),
    } as any;

    // Mock getRealtimeClient to return our mock
    const { getRealtimeClient } = require('@/lib/realtime/client');
    (getRealtimeClient as jest.Mock).mockReturnValue(mockClient);
  });

  describe('DriverLocationChannel', () => {
    describe('subscribe', () => {
      it('should subscribe to driver locations channel', async () => {
        const channel = new DriverLocationChannel();
        const onConnect = jest.fn();

        await channel.subscribe({ onConnect });

        expect(mockClient.subscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          {
            onConnect,
            onDisconnect: undefined,
            onError: undefined,
          }
        );
      });

      it('should set up location update listener when provided', async () => {
        const channel = new DriverLocationChannel();
        const onLocationUpdate = jest.fn();

        await channel.subscribe({ onLocationUpdate });

        // Channel should be subscribed
        expect(mockClient.subscribe).toHaveBeenCalled();

        // Event listener should be registered
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.DRIVER_LOCATION_UPDATED },
          expect.any(Function)
        );
      });

      it('should handle all callback options', async () => {
        const channel = new DriverLocationChannel();
        const callbacks = {
          onConnect: jest.fn(),
          onDisconnect: jest.fn(),
          onError: jest.fn(),
          onLocationUpdate: jest.fn(),
        };

        await channel.subscribe(callbacks);

        expect(mockClient.subscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          {
            onConnect: callbacks.onConnect,
            onDisconnect: callbacks.onDisconnect,
            onError: callbacks.onError,
          }
        );
      });
    });

    describe('sendLocationUpdate', () => {
      it('should broadcast location update', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const payload: DriverLocationPayload = {
          lat: 40.7128,
          lng: -74.006,
          accuracy: 10,
          speed: 25.5,
          heading: 180,
          timestamp: Date.now(),
        };

        await channel.sendLocationUpdate(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          REALTIME_EVENTS.DRIVER_LOCATION_UPDATE,
          payload
        );
      });
    });

    describe('broadcastLocationUpdate', () => {
      it('should broadcast enriched location update', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const payload: DriverLocationUpdatedPayload = {
          driverId: 'driver-123',
          driverName: 'John Doe',
          lat: 40.7128,
          lng: -74.006,
          accuracy: 10,
          speed: 25.5,
          heading: 180,
          timestamp: Date.now(),
        };

        await channel.broadcastLocationUpdate(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          REALTIME_EVENTS.DRIVER_LOCATION_UPDATED,
          payload
        );
      });
    });

    describe('on/off', () => {
      it('should add event listener', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, handler);

        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.DRIVER_LOCATION_UPDATED },
          expect.any(Function)
        );
      });

      it('should throw error if not subscribed', () => {
        const channel = new DriverLocationChannel();
        const handler = jest.fn();

        expect(() => {
          channel.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, handler);
        }).toThrow('Channel not subscribed');
      });

      it('should remove event listener', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, handler);
        channel.off(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED);

        // Event handler should be removed (we can't directly test Map.delete, but we ensure no error)
        expect(() => {
          channel.off(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED);
        }).not.toThrow();
      });
    });

    describe('unsubscribe', () => {
      it('should unsubscribe from channel', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        await channel.unsubscribe();

        expect(mockClient.unsubscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS
        );
      });

      it('should clear event handlers', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, handler);

        await channel.unsubscribe();

        // After unsubscribe, adding listeners should throw
        expect(() => {
          channel.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, handler);
        }).toThrow('Channel not subscribed');
      });
    });

    describe('isConnected', () => {
      it('should return connection status', async () => {
        const channel = new DriverLocationChannel();
        await channel.subscribe();

        const isConnected = channel.isConnected();

        expect(mockClient.isConnected).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_LOCATIONS
        );
        expect(isConnected).toBe(true);
      });
    });
  });

  describe('DriverStatusChannel', () => {
    describe('subscribe', () => {
      it('should subscribe to driver status channel', async () => {
        const channel = new DriverStatusChannel();
        const onConnect = jest.fn();

        await channel.subscribe({ onConnect });

        expect(mockClient.subscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS,
          {
            onConnect,
            onDisconnect: undefined,
            onError: undefined,
          }
        );
      });

      it('should set up status update listener when provided', async () => {
        const channel = new DriverStatusChannel();
        const onStatusUpdate = jest.fn();

        await channel.subscribe({ onStatusUpdate });

        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.DRIVER_STATUS_UPDATED },
          expect.any(Function)
        );
      });
    });

    describe('sendStatusUpdate', () => {
      it('should broadcast status update', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        const payload: DriverStatusPayload = {
          status: 'on_shift',
          shiftId: 'shift-123',
          timestamp: Date.now(),
        };

        await channel.sendStatusUpdate(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS,
          REALTIME_EVENTS.DRIVER_STATUS_UPDATE,
          payload
        );
      });
    });

    describe('broadcastStatusUpdate', () => {
      it('should broadcast enriched status update', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        const payload: DriverStatusUpdatedPayload = {
          driverId: 'driver-123',
          driverName: 'John Doe',
          status: 'on_shift',
          shiftId: 'shift-123',
          timestamp: Date.now(),
        };

        await channel.broadcastStatusUpdate(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS,
          REALTIME_EVENTS.DRIVER_STATUS_UPDATED,
          payload
        );
      });
    });

    describe('presence tracking', () => {
      it('should track presence', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        const state: PresenceState = {
          status: 'online',
          userId: 'driver-123',
          timestamp: Date.now(),
        };

        await channel.trackPresence(state);

        expect(mockClient.trackPresence).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS,
          state
        );
      });

      it('should untrack presence', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        await channel.untrackPresence();

        expect(mockClient.untrackPresence).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS
        );
      });

      it('should listen to presence changes', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.onPresence(handler);

        // Should register sync, join, and leave listeners
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'presence',
          { event: 'sync' },
          expect.any(Function)
        );
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'presence',
          { event: 'join' },
          expect.any(Function)
        );
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'presence',
          { event: 'leave' },
          expect.any(Function)
        );
      });

      it('should throw error if onPresence called before subscribe', () => {
        const channel = new DriverStatusChannel();
        const handler = jest.fn();

        expect(() => {
          channel.onPresence(handler);
        }).toThrow('Channel not subscribed');
      });
    });

    describe('unsubscribe', () => {
      it('should untrack presence before unsubscribing', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        await channel.unsubscribe();

        expect(mockClient.untrackPresence).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS
        );
        expect(mockClient.unsubscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS
        );
      });
    });

    describe('isConnected', () => {
      it('should return connection status', async () => {
        const channel = new DriverStatusChannel();
        await channel.subscribe();

        const isConnected = channel.isConnected();

        expect(mockClient.isConnected).toHaveBeenCalledWith(
          REALTIME_CHANNELS.DRIVER_STATUS
        );
        expect(isConnected).toBe(true);
      });
    });
  });

  describe('AdminCommandsChannel', () => {
    describe('subscribe', () => {
      it('should subscribe to admin commands channel', async () => {
        const channel = new AdminCommandsChannel();
        const onConnect = jest.fn();

        await channel.subscribe({ onConnect });

        expect(mockClient.subscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          {
            onConnect,
            onDisconnect: undefined,
            onError: undefined,
          }
        );
      });

      it('should set up multiple event listeners', async () => {
        const channel = new AdminCommandsChannel();
        const onDeliveryAssigned = jest.fn();
        const onMessageReceived = jest.fn();

        await channel.subscribe({ onDeliveryAssigned, onMessageReceived });

        // Both event listeners should be registered
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.DELIVERY_ASSIGNED },
          expect.any(Function)
        );
        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED },
          expect.any(Function)
        );
      });
    });

    describe('assignDelivery', () => {
      it('should broadcast delivery assignment', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const payload: DeliveryAssignmentPayload = {
          deliveryId: 'delivery-123',
          driverId: 'driver-123',
          timestamp: Date.now(),
        };

        await channel.assignDelivery(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          REALTIME_EVENTS.ADMIN_ASSIGN_DELIVERY,
          payload
        );
      });
    });

    describe('broadcastDeliveryAssigned', () => {
      it('should broadcast delivery assigned event', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const payload: DeliveryAssignedPayload = {
          deliveryId: 'delivery-123',
          driverId: 'driver-123',
          driverName: 'John Doe',
          deliveryDetails: {
            orderId: 'order-123',
            customerName: 'Jane Smith',
            address: '123 Main St',
          },
          timestamp: Date.now(),
        };

        await channel.broadcastDeliveryAssigned(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          REALTIME_EVENTS.DELIVERY_ASSIGNED,
          payload
        );
      });
    });

    describe('sendMessage', () => {
      it('should broadcast admin message', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const payload: AdminMessagePayload = {
          message: 'Please hurry with delivery #123',
          targetDriverId: 'driver-123',
          timestamp: Date.now(),
        };

        await channel.sendMessage(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          REALTIME_EVENTS.ADMIN_MESSAGE,
          payload
        );
      });
    });

    describe('broadcastMessageReceived', () => {
      it('should broadcast message received event', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const payload: AdminMessageReceivedPayload = {
          messageId: 'msg-123',
          message: 'Please hurry with delivery #123',
          senderId: 'admin-123',
          senderName: 'Admin User',
          targetDriverId: 'driver-123',
          timestamp: Date.now(),
        };

        await channel.broadcastMessageReceived(payload);

        expect(mockClient.broadcast).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED,
          payload
        );
      });
    });

    describe('on/off', () => {
      it('should add event listener', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.on(REALTIME_EVENTS.DELIVERY_ASSIGNED, handler);

        expect(mockRealtimeChannel.on).toHaveBeenCalledWith(
          'broadcast',
          { event: REALTIME_EVENTS.DELIVERY_ASSIGNED },
          expect.any(Function)
        );
      });

      it('should throw error if not subscribed', () => {
        const channel = new AdminCommandsChannel();
        const handler = jest.fn();

        expect(() => {
          channel.on(REALTIME_EVENTS.DELIVERY_ASSIGNED, handler);
        }).toThrow('Channel not subscribed');
      });

      it('should remove event listener', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const handler = jest.fn();
        channel.on(REALTIME_EVENTS.DELIVERY_ASSIGNED, handler);
        channel.off(REALTIME_EVENTS.DELIVERY_ASSIGNED);

        expect(() => {
          channel.off(REALTIME_EVENTS.DELIVERY_ASSIGNED);
        }).not.toThrow();
      });
    });

    describe('unsubscribe', () => {
      it('should unsubscribe from channel', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        await channel.unsubscribe();

        expect(mockClient.unsubscribe).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS
        );
      });
    });

    describe('isConnected', () => {
      it('should return connection status', async () => {
        const channel = new AdminCommandsChannel();
        await channel.subscribe();

        const isConnected = channel.isConnected();

        expect(mockClient.isConnected).toHaveBeenCalledWith(
          REALTIME_CHANNELS.ADMIN_COMMANDS
        );
        expect(isConnected).toBe(true);
      });
    });
  });

  describe('Convenience Functions', () => {
    it('should create DriverLocationChannel', () => {
      const channel = createDriverLocationChannel();
      expect(channel).toBeInstanceOf(DriverLocationChannel);
    });

    it('should create DriverStatusChannel', () => {
      const channel = createDriverStatusChannel();
      expect(channel).toBeInstanceOf(DriverStatusChannel);
    });

    it('should create AdminCommandsChannel', () => {
      const channel = createAdminCommandsChannel();
      expect(channel).toBeInstanceOf(AdminCommandsChannel);
    });
  });
});
