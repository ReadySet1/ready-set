/**
 * Supabase Realtime Library
 *
 * Core WebSocket functionality for real-time driver tracking and bidirectional communication.
 * Uses Supabase Realtime channels for WebSocket-based pub/sub.
 *
 * Features:
 * - Driver location broadcasting
 * - Admin real-time subscriptions
 * - Admin-to-driver messaging
 * - Delivery assignment notifications
 * - Presence tracking (driver online/offline)
 * - Auto-reconnection with exponential backoff
 * - Error handling and monitoring
 *
 * @see https://supabase.com/docs/guides/realtime
 */

import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type {
  LocationUpdate,
  TrackedDriver,
  DeliveryTracking,
} from '@/types/tracking';
import type {
  RealtimeLocationPayload,
  RealtimeDeliveryPayload,
  RealtimeMessagePayload,
  RealtimePresenceState,
  ChannelEventCallback,
  DriverLocationChannelConfig,
} from '@/types/realtime';

/**
 * Channel names for different Realtime features
 */
export const REALTIME_CHANNELS = {
  DRIVER_LOCATIONS: 'driver-locations',
  DELIVERY_ASSIGNMENTS: 'delivery-assignments',
  ADMIN_MESSAGES: 'admin-messages',
  DRIVER_PRESENCE: 'driver-presence',
} as const;

/**
 * Event types for driver location channel
 */
export const LOCATION_EVENTS = {
  UPDATE: 'location:update',
  BATCH_UPDATE: 'location:batch',
} as const;

/**
 * Event types for delivery channel
 */
export const DELIVERY_EVENTS = {
  ASSIGNED: 'delivery:assigned',
  STATUS_CHANGED: 'delivery:status',
  COMPLETED: 'delivery:completed',
} as const;

/**
 * Event types for messaging channel
 */
export const MESSAGE_EVENTS = {
  ADMIN_TO_DRIVER: 'message:admin',
  BROADCAST: 'message:broadcast',
  DELIVERED: 'message:delivered',
  READ: 'message:read',
} as const;

/**
 * Driver Location Channel
 * Handles real-time driver location updates and broadcasting
 */
export class DriverLocationChannel {
  private channel: RealtimeChannel | null = null;
  private supabase: SupabaseClient;
  private config: DriverLocationChannelConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private isConnected = false;

  constructor(supabase: SupabaseClient, config: DriverLocationChannelConfig) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * Initialize and connect to the driver location channel
   */
  async connect(): Promise<void> {
    try {
      if (this.channel) {
        console.warn('[Realtime] Channel already connected, skipping...');
        return;
      }

      // Create channel with presence tracking
      this.channel = this.supabase.channel(REALTIME_CHANNELS.DRIVER_LOCATIONS, {
        config: {
          presence: {
            key: this.config.driverId || 'admin',
          },
        },
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Subscribe to the channel
      await this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          this.reconnectAttempts = 0; // Reset on successful connection
          console.log('[Realtime] Successfully subscribed to driver locations');

          // Track presence for drivers
          if (this.config.driverId && this.config.presence) {
            await this.channel?.track({
              driver_id: this.config.driverId,
              online_at: new Date().toISOString(),
              status: 'active',
            });
          }

          // Call onConnect callback
          this.config.onConnect?.();
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error');
          this.isConnected = false;
          this.handleReconnect();
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] Connection timed out');
          this.isConnected = false;
          this.handleReconnect();
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Channel closed');
          this.isConnected = false;
        }
      });
    } catch (error) {
      console.error('[Realtime] Error connecting to channel:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Set up event handlers for the channel
   */
  private setupEventHandlers(): void {
    if (!this.channel) return;

    // Listen for location updates (for admins)
    this.channel.on('broadcast', { event: LOCATION_EVENTS.UPDATE }, (payload) => {
      try {
        const locationData = payload.payload as RealtimeLocationPayload;
        this.config.onLocationUpdate?.(locationData);
      } catch (error) {
        console.error('[Realtime] Error handling location update:', error);
        this.config.onError?.(error as Error);
      }
    });

    // Listen for batch updates (multiple drivers)
    this.channel.on('broadcast', { event: LOCATION_EVENTS.BATCH_UPDATE }, (payload) => {
      try {
        const batchData = payload.payload as RealtimeLocationPayload[];
        this.config.onBatchUpdate?.(batchData);
      } catch (error) {
        console.error('[Realtime] Error handling batch update:', error);
        this.config.onError?.(error as Error);
      }
    });

    // Listen for presence changes (driver online/offline)
    this.channel.on('presence', { event: 'sync' }, () => {
      try {
        const presenceState = this.channel?.presenceState();
        // Cast to our type - Supabase returns Record<string, Presence[]>
        this.config.onPresenceChange?.(presenceState as unknown as RealtimePresenceState || {});
      } catch (error) {
        console.error('[Realtime] Error handling presence sync:', error);
        this.config.onError?.(error as Error);
      }
    });

    this.channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      try {
        this.config.onDriverOnline?.(newPresences);
      } catch (error) {
        console.error('[Realtime] Error handling driver join:', error);
      }
    });

    this.channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      try {
        this.config.onDriverOffline?.(leftPresences);
      } catch (error) {
        console.error('[Realtime] Error handling driver leave:', error);
      }
    });
  }

  /**
   * Broadcast driver location update to all subscribers
   */
  async broadcastLocation(location: LocationUpdate): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Channel not connected. Call connect() first.');
    }

    try {
      const payload: RealtimeLocationPayload = {
        driver_id: location.driverId,
        latitude: location.coordinates.lat,
        longitude: location.coordinates.lng,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        altitude: location.altitude,
        battery_level: location.batteryLevel,
        activity_type: location.activityType,
        is_moving: location.isMoving,
        timestamp: location.timestamp.toISOString(),
      };

      await this.channel.send({
        type: 'broadcast',
        event: LOCATION_EVENTS.UPDATE,
        payload,
      });
    } catch (error) {
      console.error('[Realtime] Error broadcasting location:', error);
      this.config.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnect attempts reached');
      this.config.onError?.(new Error('Max reconnection attempts exceeded'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    const maxDelay = 30000; // Max 30 seconds
    const actualDelay = Math.min(delay, maxDelay);

    console.log(`[Realtime] Reconnecting in ${actualDelay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.disconnect();
        await this.connect();
      } catch (error) {
        console.error('[Realtime] Reconnection failed:', error);
        this.handleReconnect(); // Try again
      }
    }, actualDelay);
  }

  /**
   * Disconnect from the channel
   */
  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.unsubscribe();
        this.channel = null;
        this.isConnected = false;
        console.log('[Realtime] Disconnected from driver locations channel');
        this.config.onDisconnect?.();
      }
    } catch (error) {
      console.error('[Realtime] Error disconnecting:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get current presence state
   */
  getPresenceState(): RealtimePresenceState {
    const state = this.channel?.presenceState();
    return (state as unknown as RealtimePresenceState) || {};
  }
}

/**
 * Factory function to create a driver location channel
 */
export function createDriverLocationChannel(
  supabase: SupabaseClient,
  config: DriverLocationChannelConfig
): DriverLocationChannel {
  return new DriverLocationChannel(supabase, config);
}

/**
 * Delivery Assignment Channel
 * Handles real-time delivery assignment notifications
 */
export class DeliveryChannel {
  private channel: RealtimeChannel | null = null;
  private supabase: SupabaseClient;
  private driverId?: string;
  private onDeliveryAssigned?: (delivery: RealtimeDeliveryPayload) => void;
  private onError?: (error: Error) => void;

  constructor(
    supabase: SupabaseClient,
    driverId?: string,
    callbacks?: {
      onDeliveryAssigned?: (delivery: RealtimeDeliveryPayload) => void;
      onError?: (error: Error) => void;
    }
  ) {
    this.supabase = supabase;
    this.driverId = driverId;
    this.onDeliveryAssigned = callbacks?.onDeliveryAssigned;
    this.onError = callbacks?.onError;
  }

  async connect(): Promise<void> {
    try {
      this.channel = this.supabase.channel(REALTIME_CHANNELS.DELIVERY_ASSIGNMENTS);

      this.channel.on('broadcast', { event: DELIVERY_EVENTS.ASSIGNED }, (payload) => {
        try {
          const delivery = payload.payload as RealtimeDeliveryPayload;

          // Filter by driver ID if specified
          if (!this.driverId || delivery.driver_id === this.driverId) {
            this.onDeliveryAssigned?.(delivery);
          }
        } catch (error) {
          console.error('[Realtime] Error handling delivery assignment:', error);
          this.onError?.(error as Error);
        }
      });

      await this.channel.subscribe();
      console.log('[Realtime] Connected to delivery assignments channel');
    } catch (error) {
      console.error('[Realtime] Error connecting to delivery channel:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  async broadcastDeliveryAssignment(delivery: DeliveryTracking): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not connected');
    }

    try {
      const payload: RealtimeDeliveryPayload = {
        delivery_id: delivery.id,
        driver_id: delivery.driverId,
        status: delivery.status,
        pickup_location: {
          lat: delivery.pickupLocation.coordinates[1],
          lng: delivery.pickupLocation.coordinates[0],
        },
        delivery_location: {
          lat: delivery.deliveryLocation.coordinates[1],
          lng: delivery.deliveryLocation.coordinates[0],
        },
        estimated_arrival: delivery.estimatedArrival?.toISOString(),
        assigned_at: delivery.assignedAt.toISOString(),
      };

      await this.channel.send({
        type: 'broadcast',
        event: DELIVERY_EVENTS.ASSIGNED,
        payload,
      });
    } catch (error) {
      console.error('[Realtime] Error broadcasting delivery assignment:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

/**
 * Factory function to create a delivery channel
 */
export function createDeliveryChannel(
  supabase: SupabaseClient,
  driverId?: string,
  callbacks?: {
    onDeliveryAssigned?: (delivery: RealtimeDeliveryPayload) => void;
    onError?: (error: Error) => void;
  }
): DeliveryChannel {
  return new DeliveryChannel(supabase, driverId, callbacks);
}

/**
 * Messaging Channel
 * Handles admin-to-driver bidirectional messaging
 */
export class MessagingChannel {
  private channel: RealtimeChannel | null = null;
  private supabase: SupabaseClient;
  private userId: string;
  private onMessageReceived?: (message: RealtimeMessagePayload) => void;
  private onError?: (error: Error) => void;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    callbacks?: {
      onMessageReceived?: (message: RealtimeMessagePayload) => void;
      onError?: (error: Error) => void;
    }
  ) {
    this.supabase = supabase;
    this.userId = userId;
    this.onMessageReceived = callbacks?.onMessageReceived;
    this.onError = callbacks?.onError;
  }

  async connect(): Promise<void> {
    try {
      this.channel = this.supabase.channel(REALTIME_CHANNELS.ADMIN_MESSAGES);

      // Listen for direct messages
      this.channel.on('broadcast', { event: MESSAGE_EVENTS.ADMIN_TO_DRIVER }, (payload) => {
        try {
          const message = payload.payload as RealtimeMessagePayload;

          // Only process messages for this user or broadcasts
          if (message.to === this.userId || message.to === 'all') {
            this.onMessageReceived?.(message);
          }
        } catch (error) {
          console.error('[Realtime] Error handling message:', error);
          this.onError?.(error as Error);
        }
      });

      await this.channel.subscribe();
      console.log('[Realtime] Connected to messaging channel');
    } catch (error) {
      console.error('[Realtime] Error connecting to messaging channel:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  async sendMessage(
    to: string | 'all',
    content: string,
    priority: 'normal' | 'urgent' = 'normal'
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not connected');
    }

    try {
      const payload: RealtimeMessagePayload = {
        message_id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: this.userId,
        to,
        content,
        priority,
        timestamp: new Date().toISOString(),
      };

      await this.channel.send({
        type: 'broadcast',
        event: MESSAGE_EVENTS.ADMIN_TO_DRIVER,
        payload,
      });
    } catch (error) {
      console.error('[Realtime] Error sending message:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

/**
 * Factory function to create a messaging channel
 */
export function createMessagingChannel(
  supabase: SupabaseClient,
  userId: string,
  callbacks?: {
    onMessageReceived?: (message: RealtimeMessagePayload) => void;
    onError?: (error: Error) => void;
  }
): MessagingChannel {
  return new MessagingChannel(supabase, userId, callbacks);
}

/**
 * Utility function to broadcast location update (backward compatibility)
 */
export async function broadcastLocationUpdate(
  supabase: SupabaseClient,
  location: LocationUpdate
): Promise<void> {
  const channel = createDriverLocationChannel(supabase, {
    driverId: location.driverId,
  });

  try {
    await channel.connect();
    await channel.broadcastLocation(location);
  } finally {
    await channel.disconnect();
  }
}

/**
 * Health check function for WebSocket connection
 */
export async function checkRealtimeHealth(supabase: SupabaseClient): Promise<{
  isHealthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    // Create a temporary test channel
    const testChannel = supabase.channel('health-check-' + Date.now());

    const subscribePromise = new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, 5000);

      testChannel.subscribe((status) => {
        clearTimeout(timeout);
        if (status === 'SUBSCRIBED') {
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Channel subscription failed'));
        }
      });
    });

    await subscribePromise;
    const latency = Date.now() - startTime;

    await testChannel.unsubscribe();

    return {
      isHealthy: true,
      latency,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: (error as Error).message,
    };
  }
}
