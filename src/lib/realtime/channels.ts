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
// Broadcast listener pattern
// ============================================================================

/**
 * supabase-js v2 `RealtimeChannel` has NO per-listener removal API — there is
 * no `channel.off(...)` at runtime (it's a Phoenix Channels method that the
 * supabase wrapper does not expose). Each channel class below therefore binds
 * one STABLE dispatcher per event that reads the current handler from
 * `eventHandlers` at call time. Re-registering an event just swaps the handler
 * (no rebind → no duplicate broadcasts); `off()` mutes by dropping the handler;
 * full teardown happens via `client.unsubscribe()` → `supabase.removeChannel()`,
 * which removes every binding at once. See REA-367.
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

    // Always store the latest handler; the stable dispatcher reads it at call time.
    this.eventHandlers.set(eventName, handler);

    // Bind the dispatcher exactly once per event. Re-registering only swaps the
    // handler above (no rebind → no duplicate broadcasts). supabase-js v2 has no
    // per-listener removal, so we never call channel.off().
    if (this.listenerRefs.has(eventName)) {
      return;
    }

    const dispatch = (...args: unknown[]) => {
      const current = this.eventHandlers.get(eventName);
      if (!current) return; // removed via off()
      const envelope = (args[0] as { payload: unknown }) || { payload: args[0] };
      void current(envelope.payload as MessagePayload);
    };
    this.listenerRefs.set(eventName, dispatch);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, dispatch);
  }

  /**
   * Remove an event handler.
   *
   * supabase-js v2 has no per-listener removal, so this drops the handler from
   * the maps, which mutes the still-bound dispatcher. The binding itself is torn
   * down with the whole channel in unsubscribe() (via removeChannel).
   */
  off(eventName: RealtimeEventName): void {
    this.eventHandlers.delete(eventName);
    this.listenerRefs.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Drop handler references; removeChannel (below) tears down every binding.
    this.eventHandlers.clear();
    this.listenerRefs.clear();

    // Unsubscribe from channel (this also cleans up postgres_changes listeners)
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);

    this.channel = null;
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

    // Always store the latest handler; the stable dispatcher reads it at call time.
    this.eventHandlers.set(eventName, handler);

    // Bind the dispatcher exactly once per event. Re-registering only swaps the
    // handler above (no rebind → no duplicate broadcasts). supabase-js v2 has no
    // per-listener removal, so we never call channel.off().
    if (this.listenerRefs.has(eventName)) {
      return;
    }

    const dispatch = (...args: unknown[]) => {
      const current = this.eventHandlers.get(eventName);
      if (!current) return; // removed via off()
      const envelope = (args[0] as { payload: unknown }) || { payload: args[0] };
      void current(envelope.payload as MessagePayload);
    };
    this.listenerRefs.set(eventName, dispatch);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, dispatch);
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
   * Remove an event handler.
   *
   * supabase-js v2 has no per-listener removal, so this drops the handler from
   * the maps, which mutes the still-bound dispatcher. The binding itself is torn
   * down with the whole channel in unsubscribe() (via removeChannel).
   */
  off(eventName: RealtimeEventName): void {
    this.eventHandlers.delete(eventName);
    this.listenerRefs.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Drop handler references; removeChannel (below) tears down every binding.
    this.eventHandlers.clear();
    this.listenerRefs.clear();

    // Untrack presence
    await this.untrackPresence();

    // Unsubscribe from channel
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_STATUS);

    this.channel = null;
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

    // Always store the latest handler; the stable dispatcher reads it at call time.
    this.eventHandlers.set(eventName, handler);

    // Bind the dispatcher exactly once per event. Re-registering only swaps the
    // handler above (no rebind → no duplicate broadcasts). supabase-js v2 has no
    // per-listener removal, so we never call channel.off().
    if (this.listenerRefs.has(eventName)) {
      return;
    }

    const dispatch = (...args: unknown[]) => {
      const current = this.eventHandlers.get(eventName);
      if (!current) return; // removed via off()
      const envelope = (args[0] as { payload: unknown }) || { payload: args[0] };
      void current(envelope.payload as MessagePayload);
    };
    this.listenerRefs.set(eventName, dispatch);

    // Register listener with channel
    (this.channel as unknown as { on: (type: string, filter: { event: string }, callback: (...args: unknown[]) => void) => void }).on('broadcast', { event: eventName }, dispatch);
  }

  /**
   * Remove an event handler.
   *
   * supabase-js v2 has no per-listener removal, so this drops the handler from
   * the maps, which mutes the still-bound dispatcher. The binding itself is torn
   * down with the whole channel in unsubscribe() (via removeChannel).
   */
  off(eventName: RealtimeEventName): void {
    this.eventHandlers.delete(eventName);
    this.listenerRefs.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   * Automatically cleans up ALL listeners to prevent memory leaks
   */
  async unsubscribe(): Promise<void> {
    // Drop handler references; removeChannel (below) tears down every binding.
    this.eventHandlers.clear();
    this.listenerRefs.clear();

    // Unsubscribe from channel
    await this.client.unsubscribe(REALTIME_CHANNELS.ADMIN_COMMANDS);

    this.channel = null;
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
