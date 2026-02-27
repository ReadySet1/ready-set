/**
 * Unit tests for RealtimeClient
 */

// Mock @/utils/supabase/client (the browser client used by RealtimeClient)
jest.mock('@/utils/supabase/client');

// Mock dependencies imported by the realtime client
jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    connection: jest.fn(),
    broadcast: jest.fn(),
  },
}));

jest.mock('@/lib/rate-limiting/location-rate-limiter', () => ({
  locationRateLimiter: {
    checkLimit: jest.fn().mockReturnValue({ allowed: true, retryAfter: null, message: 'Request allowed' }),
    consume: jest.fn(),
    recordUpdate: jest.fn(),
  },
  RateLimitExceededError: class RateLimitExceededError extends Error {
    public driverId: string;
    public retryAfter: number;
    constructor(driverId: string, retryAfter: number) {
      super(`Rate limit exceeded for driver ${driverId}`);
      this.name = 'RateLimitExceededError';
      this.driverId = driverId;
      this.retryAfter = retryAfter;
    }
  },
}));

jest.mock('@/lib/realtime/schemas', () => ({
  validatePayload: jest.fn().mockImplementation((_eventName: string, payload: unknown) => payload),
  PayloadValidationError: class PayloadValidationError extends Error {
    public eventName: string;
    public errors: { issues: any[] };
    constructor(message: string, eventName: string, errors: any) {
      super(message);
      this.name = 'PayloadValidationError';
      this.eventName = eventName;
      this.errors = errors;
    }
  },
  PayloadSizeError: class PayloadSizeError extends Error {
    public eventName: string;
    public size: number;
    public maxSize: number;
    constructor(message: string, eventName: string, size: number, maxSize: number) {
      super(message);
      this.name = 'PayloadSizeError';
      this.eventName = eventName;
      this.size = size;
      this.maxSize = maxSize;
    }
  },
}));

jest.mock('@/constants/realtime-config', () => ({
  CONNECTION_CONFIG: {
    HEARTBEAT_INTERVAL: 30000,
    RECONNECT_DELAY: 1000,
    MAX_RECONNECT_ATTEMPTS: 5,
    MAX_CHANNELS: 100,
  },
  PAYLOAD_CONFIG: {
    MAX_PAYLOAD_SIZE: 65536,
    MAX_ADDRESS_LENGTH: 500,
  },
}));

// Set environment variables BEFORE importing RealtimeClient
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

import { RealtimeClient } from '@/lib/realtime/client';
import { REALTIME_CHANNELS, type RealtimeChannelName } from '@/lib/realtime/types';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

// Helper to flush all pending microtasks (allow async auth/profile checks to complete)
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('RealtimeClient', () => {
  let mockSupabaseClient: any;
  let mockChannels: Map<string, any>;
  let subscribeCallbacks: Map<string, (status: string, error?: Error) => void>;

  beforeEach(() => {
    // Reset singleton instance before each test
    RealtimeClient.resetInstance();

    // Initialize storage for multiple channels and callbacks
    mockChannels = new Map();
    subscribeCallbacks = new Map();

    // Function to create a mock channel
    const createMockChannel = (channelName: string) => {
      const mockChannel = {
        subscribe: jest.fn((callback) => {
          subscribeCallbacks.set(channelName, callback);
          return mockChannel;
        }),
        send: jest.fn().mockResolvedValue('ok'),
        track: jest.fn().mockResolvedValue(undefined),
        untrack: jest.fn().mockResolvedValue(undefined),
        on: jest.fn().mockReturnThis(),
      } as any;
      return mockChannel;
    };

    // Create mock Supabase client with auth.getUser returning a valid user
    mockSupabaseClient = {
      channel: jest.fn((channelName: string) => {
        if (!mockChannels.has(channelName)) {
          mockChannels.set(channelName, createMockChannel(channelName));
        }
        return mockChannels.get(channelName);
      }),
      removeChannel: jest.fn().mockResolvedValue({ status: 'ok', error: null }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { type: 'ADMIN' },
              error: null,
            }),
          };
        } else if (table === 'drivers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'driver-123' },
              error: null,
            }),
          };
        }
        return {} as any;
      }),
    } as any;

    // Mock createClient from @/utils/supabase/client to return our mock
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Set required environment variables
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  // Helper function to trigger subscription callback after async auth checks complete
  const triggerSubscriptionAfterAuth = async (
    channelName: RealtimeChannelName,
    status: string,
    error?: Error
  ) => {
    // Wait for microtasks to complete (auth.getUser + fetchUserContext)
    await flushPromises();
    const callback = subscribeCallbacks.get(channelName);
    if (callback) {
      callback(status, error);
    }
  };

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = RealtimeClient.getInstance();
      const instance2 = RealtimeClient.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = RealtimeClient.getInstance();
      RealtimeClient.resetInstance();
      const instance2 = RealtimeClient.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Channel Management', () => {
    it('should create a new channel when requested', () => {
      const client = RealtimeClient.getInstance();
      const channel = client.getChannel(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        {
          config: {
            broadcast: {
              self: false,
              ack: true,
            },
            presence: {
              key: '',
            },
          },
        }
      );
      expect(channel).toBe(mockChannels.get(REALTIME_CHANNELS.DRIVER_LOCATIONS));
    });

    it('should return existing channel if already created', () => {
      const client = RealtimeClient.getInstance();
      const channel1 = client.getChannel(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const channel2 = client.getChannel(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      expect(channel1).toBe(channel2);
      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);
    });

    it('should create separate channels for different names', () => {
      const client = RealtimeClient.getInstance();
      const channel1 = client.getChannel(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const channel2 = client.getChannel(REALTIME_CHANNELS.ADMIN_COMMANDS);

      expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(2);
      expect(channel1).not.toBe(channel2);
    });
  });

  describe('Channel Subscription', () => {
    it('should successfully subscribe to a channel', async () => {
      const client = RealtimeClient.getInstance();
      const onConnect = jest.fn();

      const subscribePromise = client.subscribe(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        undefined,
        { onConnect }
      );

      // Trigger after async auth/profile checks complete
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');

      const channel = await subscribePromise;

      expect(channel).toBe(mockChannels.get(REALTIME_CHANNELS.DRIVER_LOCATIONS));
      expect(onConnect).toHaveBeenCalled();
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(true);
    });

    it('should handle subscription errors', async () => {
      const client = RealtimeClient.getInstance();
      const onError = jest.fn();
      const error = new Error('Subscription failed');

      const subscribePromise = client.subscribe(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        undefined,
        { onError }
      );

      // Trigger error after auth checks
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'CHANNEL_ERROR', error);

      await expect(subscribePromise).rejects.toThrow('Subscription failed');
      expect(onError).toHaveBeenCalled();
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);
    });

    it('should handle subscription timeout', async () => {
      const client = RealtimeClient.getInstance();
      const onError = jest.fn();

      const subscribePromise = client.subscribe(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        undefined,
        { onError }
      );

      // Trigger timeout after auth checks
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'TIMED_OUT');

      await expect(subscribePromise).rejects.toThrow('Channel subscription timed out');
      expect(onError).toHaveBeenCalled();
    });

    it('should handle channel closure', async () => {
      const client = RealtimeClient.getInstance();
      const onDisconnect = jest.fn();

      const subscribePromise = client.subscribe(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        undefined,
        { onDisconnect }
      );

      // First connect
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      // Then close (callback already registered, no need to flush again)
      const callback = subscribeCallbacks.get(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      if (callback) callback('CLOSED');

      expect(onDisconnect).toHaveBeenCalled();
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);
    });

    it('should update connection state during subscription lifecycle', async () => {
      const client = RealtimeClient.getInstance();

      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      // Wait for auth to complete so channel.subscribe is called and state is 'connecting'
      await flushPromises();

      // Check connecting state
      let state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('connecting');

      // Simulate successful connection
      const callback = subscribeCallbacks.get(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      if (callback) callback('SUBSCRIBED');
      await subscribePromise;

      // Check connected state
      state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('connected');
      expect(state.connectedAt).toBeInstanceOf(Date);
      expect(state.reconnectAttempts).toBe(0);
    });
  });

  describe('Channel Unsubscription', () => {
    it('should unsubscribe from a channel', async () => {
      const client = RealtimeClient.getInstance();

      // First subscribe
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      // Then unsubscribe
      await client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(
        mockChannels.get(REALTIME_CHANNELS.DRIVER_LOCATIONS)
      );
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);
    });

    it('should handle unsubscribing from non-existent channel gracefully', async () => {
      const client = RealtimeClient.getInstance();

      await expect(
        client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS)
      ).resolves.not.toThrow();
    });

    it('should disconnect from all channels', async () => {
      const client = RealtimeClient.getInstance();

      // Subscribe to multiple channels
      const subscribe1 = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const subscribe2 = client.subscribe(REALTIME_CHANNELS.ADMIN_COMMANDS);

      // Trigger both subscriptions after auth
      await flushPromises();
      const cb1 = subscribeCallbacks.get(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const cb2 = subscribeCallbacks.get(REALTIME_CHANNELS.ADMIN_COMMANDS);
      if (cb1) cb1('SUBSCRIBED');
      if (cb2) cb2('SUBSCRIBED');

      await Promise.all([subscribe1, subscribe2]);

      // Disconnect all
      await client.disconnectAll();

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledTimes(2);
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);
      expect(client.isConnected(REALTIME_CHANNELS.ADMIN_COMMANDS)).toBe(false);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast an event successfully', async () => {
      const client = RealtimeClient.getInstance();

      // First subscribe
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      // Broadcast event (as ADMIN, which can broadcast driver:location? No — ADMIN is not in BROADCAST_ACCESS_RULES for driver:location)
      // Use a generic event name that has no rules defined (backwards compatible = allowed)
      const payload = { lat: 40.7128, lng: -74.006, timestamp: Date.now() };
      await client.broadcast(
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
        'test:event',
        payload
      );

      expect(mockChannels.get(REALTIME_CHANNELS.DRIVER_LOCATIONS)!.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'test:event',
        payload,
      });
    });

    it('should throw error when broadcasting to non-subscribed channel', async () => {
      const client = RealtimeClient.getInstance();

      await expect(
        client.broadcast(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          'test:event',
          {}
        )
      ).rejects.toThrow('Channel driver-locations is not subscribed');
    });

    it('should throw error when broadcasting to disconnected channel', async () => {
      const client = RealtimeClient.getInstance();

      // Create the channel via getChannel but don't subscribe (state = disconnected)
      client.getChannel(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      await expect(
        client.broadcast(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          'test:event',
          {}
        )
      ).rejects.toThrow('Channel driver-locations is not connected');
    });

    it('should throw error when broadcast fails', async () => {
      const client = RealtimeClient.getInstance();

      // Subscribe successfully
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      // Mock send to fail
      mockChannels.get(REALTIME_CHANNELS.DRIVER_LOCATIONS)!.send.mockResolvedValueOnce('error' as any);

      await expect(
        client.broadcast(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          'test:event',
          {}
        )
      ).rejects.toThrow('Failed to broadcast to channel driver-locations');
    });
  });

  describe('Presence Tracking', () => {
    it('should track presence on a channel', async () => {
      const client = RealtimeClient.getInstance();

      // First subscribe
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_STATUS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_STATUS, 'SUBSCRIBED');
      await subscribePromise;

      // Track presence
      const presenceState = { status: 'online', userId: '123' };
      await client.trackPresence(REALTIME_CHANNELS.DRIVER_STATUS, presenceState);

      expect(mockChannels.get(REALTIME_CHANNELS.DRIVER_STATUS)!.track).toHaveBeenCalledWith(presenceState);
    });

    it('should untrack presence on a channel', async () => {
      const client = RealtimeClient.getInstance();

      // First subscribe
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_STATUS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_STATUS, 'SUBSCRIBED');
      await subscribePromise;

      // Untrack presence
      await client.untrackPresence(REALTIME_CHANNELS.DRIVER_STATUS);

      expect(mockChannels.get(REALTIME_CHANNELS.DRIVER_STATUS)!.untrack).toHaveBeenCalled();
    });

    it('should throw error when tracking presence on non-subscribed channel', async () => {
      const client = RealtimeClient.getInstance();

      await expect(
        client.trackPresence(REALTIME_CHANNELS.DRIVER_STATUS, {})
      ).rejects.toThrow('Channel driver-status is not subscribed');
    });

    it('should handle untracking presence on non-subscribed channel gracefully', async () => {
      const client = RealtimeClient.getInstance();

      await expect(
        client.untrackPresence(REALTIME_CHANNELS.DRIVER_STATUS)
      ).resolves.not.toThrow();
    });
  });

  describe('Connection State Management', () => {
    it('should initialize connection state for a new channel', () => {
      const client = RealtimeClient.getInstance();
      const state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      expect(state.state).toBe('disconnected');
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should correctly report connection status', async () => {
      const client = RealtimeClient.getInstance();

      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);

      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(true);
    });

    it('should track connection state changes', async () => {
      const client = RealtimeClient.getInstance();

      // Initial state
      let state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('disconnected');

      // Connecting
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await flushPromises();
      state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('connecting');

      // Connected
      const callback = subscribeCallbacks.get(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      if (callback) callback('SUBSCRIBED');
      await subscribePromise;
      state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('connected');

      // Disconnected
      if (callback) callback('CLOSED');
      state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('disconnected');
    });
  });

  describe('Supabase Client Access', () => {
    it('should provide access to Supabase client', () => {
      const client = RealtimeClient.getInstance();
      const supabase = client.getSupabaseClient();

      expect(supabase).toBe(mockSupabaseClient);
    });
  });

  describe('Error Handling', () => {
    it('should track error state when subscription fails', async () => {
      const client = RealtimeClient.getInstance();
      const error = new Error('Connection failed');

      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'CHANNEL_ERROR', error);

      await expect(subscribePromise).rejects.toThrow();

      const state = client.getConnectionState(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      expect(state.state).toBe('error');
      expect(state.error).toBeDefined();
    });

    it('should handle resetInstance when channels are open', async () => {
      const client = RealtimeClient.getInstance();

      // Subscribe to channel
      const subscribePromise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
      await subscribePromise;

      // Reset should disconnect all
      expect(() => RealtimeClient.resetInstance()).not.toThrow();
      expect(mockSupabaseClient.removeChannel).toHaveBeenCalled();
    });
  });

  describe('Multiple Channels', () => {
    it('should manage multiple channels independently', async () => {
      const client = RealtimeClient.getInstance();

      // Subscribe to multiple channels
      const subscribe1 = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const subscribe2 = client.subscribe(REALTIME_CHANNELS.ADMIN_COMMANDS);

      // Trigger both subscriptions after auth
      await flushPromises();
      const cb1 = subscribeCallbacks.get(REALTIME_CHANNELS.DRIVER_LOCATIONS);
      const cb2 = subscribeCallbacks.get(REALTIME_CHANNELS.ADMIN_COMMANDS);
      if (cb1) cb1('SUBSCRIBED');
      if (cb2) cb2('SUBSCRIBED');

      await Promise.all([subscribe1, subscribe2]);

      // Both should be connected
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(true);
      expect(client.isConnected(REALTIME_CHANNELS.ADMIN_COMMANDS)).toBe(true);

      // Unsubscribe from one
      await client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

      // First should be disconnected, second still connected
      expect(client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS)).toBe(false);
      expect(client.isConnected(REALTIME_CHANNELS.ADMIN_COMMANDS)).toBe(true);
    });
  });

  describe('Authorization Tests', () => {
    describe('subscribe authorization', () => {
      it('should allow ADMIN to subscribe to DRIVER_LOCATIONS channel', async () => {
        const client = RealtimeClient.getInstance();

        // Subscribe without providing userContext (will fetch from database)
        const promise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

        // Trigger subscription success
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');

        await expect(promise).resolves.toBeDefined();
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      });

      it('should prevent CLIENT from subscribing to ADMIN_COMMANDS channel', async () => {
        // Mock profile as CLIENT user type
        mockSupabaseClient.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { type: 'CLIENT' },
            error: null,
          }),
        })) as any;

        const client = RealtimeClient.getInstance();

        // Should throw UnauthorizedError
        await expect(
          client.subscribe(REALTIME_CHANNELS.ADMIN_COMMANDS)
        ).rejects.toThrow('Access denied to channel');
      });

      it('should fetch user context from database when not provided', async () => {
        const client = RealtimeClient.getInstance();

        const promise = client.subscribe(REALTIME_CHANNELS.DRIVER_STATUS);
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_STATUS, 'SUBSCRIBED');

        await promise;

        // Verify database queries were made
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      });

      it('should use provided userContext for authorization', async () => {
        const client = RealtimeClient.getInstance();

        const userContext = {
          userId: 'test-user-id',
          userType: 'SUPER_ADMIN' as const,
        };

        const promise = client.subscribe(
          REALTIME_CHANNELS.ADMIN_COMMANDS,
          userContext
        );
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.ADMIN_COMMANDS, 'SUBSCRIBED');

        await promise;

        // Should NOT fetch from database when userContext provided
        expect(mockSupabaseClient.auth.getUser).not.toHaveBeenCalled();
      });
    });

    describe('broadcast authorization', () => {
      beforeEach(async () => {
        const client = RealtimeClient.getInstance();

        // Subscribe to channel first
        const promise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');
        await promise;
      });

      it('should allow DRIVER to broadcast driver:location events', async () => {
        // Mock as DRIVER user type
        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: 'DRIVER' },
                error: null,
              }),
            };
          } else if (table === 'drivers') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'driver-123' },
                error: null,
              }),
            };
          }
          return {} as any;
        }) as any;

        const client = RealtimeClient.getInstance();

        const payload = {
          driverId: 'driver-123',
          lat: 40.7128,
          lng: -74.006,
          timestamp: new Date().toISOString(),
        };

        // Should not throw
        await expect(
          client.broadcast(
            REALTIME_CHANNELS.DRIVER_LOCATIONS,
            'driver:location',
            payload
          )
        ).resolves.toBeUndefined();

        // Verify database fetch occurred
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      });

      it('should prevent DRIVER from broadcasting admin:message events', async () => {
        // Mock as DRIVER user type
        mockSupabaseClient.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { type: 'DRIVER' },
            error: null,
          }),
        })) as any;

        const client = RealtimeClient.getInstance();

        const payload = {
          message: 'Test admin message',
          timestamp: new Date().toISOString(),
        };

        // Should throw UnauthorizedError
        await expect(
          client.broadcast(
            REALTIME_CHANNELS.DRIVER_LOCATIONS,
            'admin:message',
            payload
          )
        ).rejects.toThrow('is not authorized to broadcast');
      });

      it('should validate driver ID matches in payload', async () => {
        const client = RealtimeClient.getInstance();

        const userContext = {
          userId: 'test-user-id',
          userType: 'DRIVER' as const,
          driverId: 'driver-123',
        };

        const payload = {
          driverId: 'different-driver-456', // Mismatched driver ID
          lat: 40.7128,
          lng: -74.006,
          timestamp: new Date().toISOString(),
        };

        // Should throw UnauthorizedError for driver ID mismatch
        await expect(
          client.broadcast(
            REALTIME_CHANNELS.DRIVER_LOCATIONS,
            'driver:location',
            payload,
            userContext
          )
        ).rejects.toThrow('Driver ID in payload does not match');
      });

      it('should fetch user context from database when not provided for broadcast', async () => {
        const client = RealtimeClient.getInstance();

        const payload = {
          lat: 40.7128,
          lng: -74.006,
          timestamp: new Date().toISOString(),
        };

        // Reset mock call counts
        jest.clearAllMocks();

        // Use a generic event that ADMIN can broadcast (no rules = allowed)
        await client.broadcast(
          REALTIME_CHANNELS.DRIVER_LOCATIONS,
          'test:event',
          payload
        );

        // Verify database queries were made
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      });
    });

    describe('database context fetching', () => {
      it('should throw error if user profile not found', async () => {
        // Mock profile not found
        mockSupabaseClient.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Profile not found'),
          }),
        })) as any;

        const client = RealtimeClient.getInstance();

        await expect(
          client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS)
        ).rejects.toThrow('Unable to verify user permissions');
      });

      it('should fetch driver ID for DRIVER user type', async () => {
        // Mock as DRIVER user type
        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: 'DRIVER' },
                error: null,
              }),
            };
          } else if (table === 'drivers') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'driver-456' },
                error: null,
              }),
            };
          }
          return {} as any;
        }) as any;

        const client = RealtimeClient.getInstance();

        const promise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');

        await promise;

        // Verify both profiles and drivers tables were queried
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('drivers');
      });

      it('should not throw if driver record not found for DRIVER user', async () => {
        // Mock as DRIVER user type but no driver record
        mockSupabaseClient.from = jest.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { type: 'DRIVER' },
                error: null,
              }),
            };
          } else if (table === 'drivers') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Driver not found'),
              }),
            };
          }
          return {} as any;
        }) as any;

        const client = RealtimeClient.getInstance();

        // Should not throw - driver may not be assigned yet
        const promise = client.subscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
        await triggerSubscriptionAfterAuth(REALTIME_CHANNELS.DRIVER_LOCATIONS, 'SUBSCRIBED');

        await expect(promise).resolves.toBeDefined();
      });
    });
  });
});
