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
// Driver Location Channel
// ============================================================================

export class DriverLocationChannel {
  private channel: RealtimeChannel | null = null;
  private client = getRealtimeClient();
  private eventHandlers: Map<string, RealtimeEventHandler> = new Map();
  private listenerRefs: Map<string, Function> = new Map(); // Store listener references for cleanup

  /**
   * Subscribe to driver location updates
   */
  async subscribe(callbacks?: {
    onLocationUpdate?: RealtimeEventHandler<DriverLocationUpdatedPayload>;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.channel = await this.client.subscribe(
      REALTIME_CHANNELS.DRIVER_LOCATIONS,
      {
        onConnect: callbacks?.onConnect,
        onDisconnect: callbacks?.onDisconnect,
        onError: callbacks?.onError,
      },
    );

    // Set up event listeners
    if (callbacks?.onLocationUpdate) {
      this.on(REALTIME_EVENTS.DRIVER_LOCATION_UPDATED, callbacks.onLocationUpdate);
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
    const listener = (payload: { payload: T }) => handler(payload.payload);
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    this.channel.on('broadcast', { event: eventName }, listener);
  }

  /**
   * Remove event listener with improved error handling
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      try {
        // Phoenix Channels has off() but @supabase/supabase-js types don't expose it
        const channel = this.channel as any;
        if (typeof channel.off === 'function') {
          channel.off('broadcast', { event: eventName }, listener);
        } else {
          realtimeLogger.warn('off() method not available on channel', {
            eventName,
            channel: REALTIME_CHANNELS.DRIVER_LOCATIONS,
          });
        }
      } catch (error) {
        realtimeLogger.error('Failed to remove event listener', {
          eventName,
          error,
          channel: REALTIME_CHANNELS.DRIVER_LOCATIONS,
        });
      }
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   */
  async unsubscribe(): Promise<void> {
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_LOCATIONS);
    this.channel = null;
    this.eventHandlers.clear();
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
  private listenerRefs: Map<string, Function> = new Map(); // Store listener references for cleanup

  /**
   * Subscribe to driver status updates
   */
  async subscribe(callbacks?: {
    onStatusUpdate?: RealtimeEventHandler<DriverStatusUpdatedPayload>;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
  }): Promise<void> {
    this.channel = await this.client.subscribe(REALTIME_CHANNELS.DRIVER_STATUS, {
      onConnect: callbacks?.onConnect,
      onDisconnect: callbacks?.onDisconnect,
      onError: callbacks?.onError,
    });

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
  on<T = any>(eventName: RealtimeEventName, handler: RealtimeEventHandler<T>): void {
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
    const listener = (payload: any) => handler(payload.payload);
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    this.channel.on('broadcast', { event: eventName }, listener);
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
   * Remove event listener
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      // Actually remove the listener from the channel
      // Note: Phoenix Channels has off() but @supabase/supabase-js types don't expose it
      (this.channel as any).off('broadcast', { event: eventName }, listener);
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   */
  async unsubscribe(): Promise<void> {
    await this.untrackPresence();
    await this.client.unsubscribe(REALTIME_CHANNELS.DRIVER_STATUS);
    this.channel = null;
    this.eventHandlers.clear();
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
  private listenerRefs: Map<string, Function> = new Map(); // Store listener references for cleanup

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
    this.channel = await this.client.subscribe(REALTIME_CHANNELS.ADMIN_COMMANDS, {
      onConnect: callbacks?.onConnect,
      onDisconnect: callbacks?.onDisconnect,
      onError: callbacks?.onError,
    });

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
  on<T = any>(eventName: RealtimeEventName, handler: RealtimeEventHandler<T>): void {
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
    const listener = (payload: any) => handler(payload.payload);
    this.listenerRefs.set(eventName, listener);
    this.eventHandlers.set(eventName, handler);

    // Register listener with channel
    this.channel.on('broadcast', { event: eventName }, listener);
  }

  /**
   * Remove event listener
   */
  off(eventName: RealtimeEventName): void {
    const listener = this.listenerRefs.get(eventName);
    if (listener && this.channel) {
      // Actually remove the listener from the channel
      // Note: Phoenix Channels has off() but @supabase/supabase-js types don't expose it
      (this.channel as any).off('broadcast', { event: eventName }, listener);
    }
    this.listenerRefs.delete(eventName);
    this.eventHandlers.delete(eventName);
  }

  /**
   * Unsubscribe from the channel
   */
  async unsubscribe(): Promise<void> {
    await this.client.unsubscribe(REALTIME_CHANNELS.ADMIN_COMMANDS);
    this.channel = null;
    this.eventHandlers.clear();
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
