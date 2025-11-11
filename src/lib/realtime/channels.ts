/**
 * Supabase Realtime Channel Management
 *
 * High-level utilities for managing real-time channels and events.
 * Provides convenient wrappers around the Realtime client.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { getRealtimeClient } from './client';
import {
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  type RealtimeChannelName,
  type RealtimeEventName,
  type RealtimeEventHandler,
  type DriverLocationPayload,
  type DriverLocationUpdatedPayload,
  type DriverStatusPayload,
  type DriverStatusUpdatedPayload,
  type DeliveryAssignmentPayload,
  type DeliveryAssignedPayload,
  type AdminMessagePayload,
  type AdminMessageReceivedPayload,
  type HeartbeatPayload,
  type PresenceState,
  RealtimeConnectionError,
  RealtimeBroadcastError,
  type MessagePayload,
} from './types';
import { realtimeLogger } from '../logging/realtime-logger';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type augmentation for RealtimeChannel is now in types/supabase-realtime.d.ts
 * This provides proper TypeScript support for the off() method from Phoenix Channels.
 *
 * @see types/supabase-realtime.d.ts
 */

// ============================================================================
// Driver Location Channel
// ============================================================================

export class DriverLocationChannel {
  private channel: RealtimeChannel | null = null;
  private client = getRealtimeClient();
  private eventHandlers: Map<string, RealtimeEventHandler> = new Map();
  private listenerRefs: Map<string, (...args: unknown[]) => void> = new Map(); // Store listener references for cleanup

  /**
   * Subscribe to driver location updates
   *
   * Supports both real-time broadcasts AND database changes:
   * - Broadcasts: Low-latency real-time updates sent by drivers/server
   * - Database changes: Captures ALL location inserts (even from REST API/SQL)
   *
   * The database trigger (migration 20251107000008) also broadcasts via pg_notify,
   * providing historical replay capability and ensuring no updates are missed.
   */
  async subscribe(callbacks?: {
    onLocationUpdate?: RealtimeEventHandler<DriverLocationUpdatedPayload>;
    onDatabaseInsert?: (payload: any) => void; // Database INSERT events
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.channel = await this.client.subscribe(
      REALTIME_CHANNELS.DRIVER_LOCATIONS,
      undefined,
      {
        onConnect: callbacks?.onConnect,
        onDisconnect: callbacks?.onDisconnect,
        onError: callbacks?.onError,
      },
    );

    // Set up broadcast event listeners
    if (callbacks?.onLocationUpdate) {
      this.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, callbacks.onLocationUpdate);
    }

    // Set up postgres_changes listener to capture database INSERTs
    // This ensures we receive ALL location updates, even those from REST API or SQL
    if (callbacks?.onDatabaseInsert && this.channel) {
      this.channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'driver_locations',
          },
          (payload) => {
            realtimeLogger.debug('Database INSERT detected', {
              metadata: {
                driverId: payload.new?.driver_id,
                timestamp: payload.new?.recorded_at,
              },
            });
            callbacks.onDatabaseInsert?.(payload.new);
          }
        );
    }
  }

  /**
   * Send driver location update
   */
  async sendLocationUpdate(payload: DriverLocationPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.DRIVER_LOCATIONS,
      REALTIME_EVENTS.DRIVER_LOCATION_UPDATE,
      payload,
    );
  }

  /**
   * Broadcast driver location update (server-side)
   */
  async broadcastLocationUpdate(payload: DriverLocationUpdatedPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.DRIVER_LOCATIONS,
      REALTIME_EVENTS.DRIVER_LOCATION_UPDATED,
      payload,
    );
  }

  /**
   * Listen to specific events
   */
  on<T extends MessagePayload = MessagePayload>(
    eventName: RealtimeEventName,
    handler: RealtimeEventHandler<T>
  ): void {
    if (!this.channel) {
      throw new RealtimeConnectionError(
        'Channel not subscribed. Call subscribe() first.',
        REALTIME_CHANNELS.DRIVER_LOCATIONS,
      );
    }

    // Remove existing listener first to prevent duplicates
    if (this.listenerRefs.has(eventName)) {
      this.off(eventName);
    }

    // Create listener function and store reference
    // Wrap handler to match Phoenix channel listener signature and handle async
    const listener = (...args: unknown[]) => {
      const payload = (args[0] as { payload: T }) || { payload: args[0] as T };
      void handler(payload.payload);
    };
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, listener);
  }

  /**
   * Remove event listener with improved error handling
   *
   * Uses the off() method from Phoenix Channels (now properly typed via type augmentation)
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      try {
        // off() method is now properly typed via types/supabase-realtime.d.ts
        this.channel.off('broadcast', { event: eventName }, listener);
      } catch (error) {
        // Phoenix Channels doesn't expose structured error types, so we use message matching
        // Expected errors during cleanup (listener already removed, channel closed, etc.)
        const errorMessage = (error as Error)?.message || '';
        const isExpectedCleanupError =
          errorMessage.includes('not found') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('already removed') ||
          errorMessage.includes('closed');

        if (!isExpectedCleanupError) {
          // Log unexpected errors for debugging, but continue cleanup
          realtimeLogger.warn('Unexpected error during event listener cleanup', {
            metadata: {
              eventName,
              channel: REALTIME_CHANNELS.DRIVER_LOCATIONS,
              errorMessage,
              errorType: error?.constructor?.name || 'Unknown',
            },
          });
        }
      }
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Clean up all broadcast event listeners
    for (const eventName of this.listenerRefs.keys()) {
      this.off(eventName as RealtimeEventName);
    }

    // Unsubscribe from channel (this also cleans up postgres_changes listeners)
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

    // Clear all references
    this.channel = null;
    this.eventHandlers.clear();
    this.listenerRefs.clear();
  }

  /**
   * Check if channel is connected
   */
  isConnected(): boolean {
    return this.client.isConnected(REALTIME_CHANNELS.DRIVER_LOCATIONS);
  }
}

// ============================================================================
// Driver Status Channel
// ============================================================================

export class DriverStatusChannel {
  private channel: RealtimeChannel | null = null;
  private client = getRealtimeClient();
  private eventHandlers: Map<string, RealtimeEventHandler> = new Map();
  private listenerRefs: Map<string, (...args: unknown[]) => void> = new Map(); // Store listener references for cleanup

  /**
   * Subscribe to driver status updates
   */
  async subscribe(callbacks?: {
    onStatusUpdate?: RealtimeEventHandler<DriverStatusUpdatedPayload>;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.channel = await this.client.subscribe(
      REALTIME_CHANNELS.DRIVER_STATUS,
      undefined,
      {
        onConnect: callbacks?.onConnect,
        onDisconnect: callbacks?.onDisconnect,
        onError: callbacks?.onError,
      },
    );

    // Set up event listeners
    if (callbacks?.onStatusUpdate) {
      this.on(REALTIME_EVENTS.DRIVER_STATUS_UPDATED, callbacks.onStatusUpdate);
    }
  }

  /**
   * Send driver status update
   */
  async sendStatusUpdate(payload: DriverStatusPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.DRIVER_STATUS,
      REALTIME_EVENTS.DRIVER_STATUS_UPDATE,
      payload,
    );
  }

  /**
   * Broadcast driver status update (server-side)
   */
  async broadcastStatusUpdate(payload: DriverStatusUpdatedPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.DRIVER_STATUS,
      REALTIME_EVENTS.DRIVER_STATUS_UPDATED,
      payload,
    );
  }

  /**
   * Track driver presence
   */
  async trackPresence(state: PresenceState): Promise<void> {
    await this.client.trackPresence(REALTIME_CHANNELS.DRIVER_STATUS, state);
  }

  /**
   * Untrack driver presence
   */
  async untrackPresence(): Promise<void> {
    await this.client.untrackPresence(REALTIME_CHANNELS.DRIVER_STATUS);
  }

  /**
   * Listen to specific events
   */
  on<T = MessagePayload>(eventName: RealtimeEventName, handler: RealtimeEventHandler<T>): void {
    if (!this.channel) {
      throw new RealtimeConnectionError(
        'Channel not subscribed. Call subscribe() first.',
        REALTIME_CHANNELS.DRIVER_STATUS,
      );
    }

    // Remove existing listener first to prevent duplicates
    if (this.listenerRefs.has(eventName)) {
      this.off(eventName);
    }

    // Create listener function and store reference
    // Wrap handler to match Phoenix channel listener signature and handle async
    const listener = (...args: unknown[]) => {
      const payload = (args[0] as { payload: T }) || { payload: args[0] as T };
      void handler(payload.payload);
    };
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, listener);
  }

  /**
   * Listen to presence changes
   */
  onPresence(handler: (payload: any) => void): void {
    if (!this.channel) {
      throw new RealtimeConnectionError(
        'Channel not subscribed. Call subscribe() first.',
        REALTIME_CHANNELS.DRIVER_STATUS,
      );
    }

    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel!.presenceState();
      handler(state);
    });

    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      handler({ event: 'join', key, newPresences });
    });

    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      handler({ event: 'leave', key, leftPresences });
    });
  }

  /**
   * Remove event listener with improved error handling
   *
   * Uses the off() method from Phoenix Channels (now properly typed via type augmentation)
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      try {
        // off() method is now properly typed via types/supabase-realtime.d.ts
        this.channel.off('broadcast', { event: eventName }, listener);
      } catch (error) {
        // Phoenix Channels doesn't expose structured error types, so we use message matching
        // Expected errors during cleanup (listener already removed, channel closed, etc.)
        const errorMessage = (error as Error)?.message || '';
        const isExpectedCleanupError =
          errorMessage.includes('not found') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('already removed') ||
          errorMessage.includes('closed');

        if (!isExpectedCleanupError) {
          // Log unexpected errors for debugging, but continue cleanup
          realtimeLogger.warn('Unexpected error during event listener cleanup', {
            metadata: {
              eventName,
              channel: REALTIME_CHANNELS.DRIVER_STATUS,
              errorMessage,
              errorType: error?.constructor?.name || 'Unknown',
            },
          });
        }
      }
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Clean up all broadcast event listeners
    for (const eventName of this.listenerRefs.keys()) {
      this.off(eventName as RealtimeEventName);
    }

    // Untrack presence
    await this.untrackPresence();

    // Unsubscribe from channel
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_STATUS);

    // Clear all references
    this.channel = null;
    this.eventHandlers.clear();
    this.listenerRefs.clear();
  }

  /**
   * Check if channel is connected
   */
  isConnected(): boolean {
    return this.client.isConnected(REALTIME_CHANNELS.DRIVER_STATUS);
  }
}

// ============================================================================
// Admin Commands Channel
// ============================================================================

export class AdminCommandsChannel {
  private channel: RealtimeChannel | null = null;
  private client = getRealtimeClient();
  private eventHandlers: Map<string, RealtimeEventHandler> = new Map();
  private listenerRefs: Map<string, (...args: unknown[]) => void> = new Map(); // Store listener references for cleanup

  /**
   * Subscribe to admin commands
   */
  async subscribe(callbacks?: {
    onDeliveryAssigned?: RealtimeEventHandler<DeliveryAssignedPayload>;
    onMessageReceived?: RealtimeEventHandler<AdminMessageReceivedPayload>;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.channel = await this.client.subscribe(
      REALTIME_CHANNELS.ADMIN_COMMANDS,
      undefined,
      {
        onConnect: callbacks?.onConnect,
        onDisconnect: callbacks?.onDisconnect,
        onError: callbacks?.onError,
      },
    );

    // Set up event listeners
    if (callbacks?.onDeliveryAssigned) {
      this.on(REALTIME_EVENTS.DELIVERY_ASSIGNED, callbacks.onDeliveryAssigned);
    }

    if (callbacks?.onMessageReceived) {
      this.on(REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED, callbacks.onMessageReceived);
    }
  }

  /**
   * Send delivery assignment command
   */
  async assignDelivery(payload: DeliveryAssignmentPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.ADMIN_COMMANDS,
      REALTIME_EVENTS.ADMIN_ASSIGN_DELIVERY,
      payload,
    );
  }

  /**
   * Broadcast delivery assigned event (server-side)
   */
  async broadcastDeliveryAssigned(payload: DeliveryAssignedPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.ADMIN_COMMANDS,
      REALTIME_EVENTS.DELIVERY_ASSIGNED,
      payload,
    );
  }

  /**
   * Send admin message
   */
  async sendMessage(payload: AdminMessagePayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.ADMIN_COMMANDS,
      REALTIME_EVENTS.ADMIN_MESSAGE,
      payload,
    );
  }

  /**
   * Broadcast admin message received event (server-side)
   */
  async broadcastMessageReceived(payload: AdminMessageReceivedPayload): Promise<void> {
    await this.client.broadcast(
      REALTIME_CHANNELS.ADMIN_COMMANDS,
      REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED,
      payload,
    );
  }

  /**
   * Listen to specific events
   */
  on<T = MessagePayload>(eventName: RealtimeEventName, handler: RealtimeEventHandler<T>): void {
    if (!this.channel) {
      throw new RealtimeConnectionError(
        'Channel not subscribed. Call subscribe() first.',
        REALTIME_CHANNELS.ADMIN_COMMANDS,
      );
    }

    // Remove existing listener first to prevent duplicates
    if (this.listenerRefs.has(eventName)) {
      this.off(eventName);
    }

    // Create listener function and store reference
    // Wrap handler to match Phoenix channel listener signature and handle async
    const listener = (...args: unknown[]) => {
      const payload = (args[0] as { payload: T }) || { payload: args[0] as T };
      void handler(payload.payload);
    };
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, listener);
  }

  /**
   * Remove event listener with improved error handling
   *
   * Uses the off() method from Phoenix Channels (now properly typed via type augmentation)
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      try {
        // off() method is now properly typed via types/supabase-realtime.d.ts
        this.channel.off('broadcast', { event: eventName }, listener);
      } catch (error) {
        // Phoenix Channels doesn't expose structured error types, so we use message matching
        // Expected errors during cleanup (listener already removed, channel closed, etc.)
        const errorMessage = (error as Error)?.message || '';
        const isExpectedCleanupError =
          errorMessage.includes('not found') ||
          errorMessage.includes('does not exist') ||
          errorMessage.includes('already removed') ||
          errorMessage.includes('closed');

        if (!isExpectedCleanupError) {
          // Log unexpected errors for debugging, but continue cleanup
          realtimeLogger.warn('Unexpected error during event listener cleanup', {
            metadata: {
              eventName,
              channel: REALTIME_CHANNELS.ADMIN_COMMANDS,
              errorMessage,
              errorType: error?.constructor?.name || 'Unknown',
            },
          });
        }
      }
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Clean up all broadcast event listeners
    for (const eventName of this.listenerRefs.keys()) {
      this.off(eventName as RealtimeEventName);
    }

    // Unsubscribe from channel
    await this.client.unsubscribe(REALTIME_CHANNELS.ADMIN_COMMANDS);

    // Clear all references
    this.channel = null;
    this.eventHandlers.clear();
    this.listenerRefs.clear();
  }

  /**
   * Check if channel is connected
   */
  isConnected(): boolean {
    return this.client.isConnected(REALTIME_CHANNELS.ADMIN_COMMANDS);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a new driver location channel
 */
export function createDriverLocationChannel(): DriverLocationChannel {
  return new DriverLocationChannel();
}

/**
 * Create a new driver status channel
 */
export function createDriverStatusChannel(): DriverStatusChannel {
  return new DriverStatusChannel();
}

/**
 * Create a new admin commands channel
 */
export function createAdminCommandsChannel(): AdminCommandsChannel {
  return new AdminCommandsChannel();
}
