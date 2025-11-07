/**
 * Supabase Realtime Client
 *
 * Singleton client for managing Supabase Realtime connections.
 * Provides a centralized interface for all real-time communication.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  REALTIME_CHANNELS,
  type RealtimeChannelName,
  type ConnectionState,
  type RealtimeConnectionState,
  RealtimeConnectionError,
  RealtimeAuthenticationError,
} from './types';

// ============================================================================
// Client Configuration
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Realtime configuration
// NOTE: Heartbeat removed - Supabase Realtime has built-in WebSocket heartbeats
const REALTIME_CONFIG = {
  reconnectDelay: 1000, // 1 second
  reconnectDelayMax: 5000, // 5 seconds
  reconnectAttempts: Infinity,
  timeout: 10000, // 10 seconds
};

// ============================================================================
// Realtime Client Class
// ============================================================================

export class RealtimeClient {
  private static instance: RealtimeClient | null = null;
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionStates: Map<string, RealtimeConnectionState> = new Map();

  private constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new RealtimeAuthenticationError(
        'Supabase URL and Anon Key must be configured',
      );
    }

    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  /**
   * Get the singleton instance of RealtimeClient
   */
  public static getInstance(): RealtimeClient {
    if (!RealtimeClient.instance) {
      RealtimeClient.instance = new RealtimeClient();
    }
    return RealtimeClient.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (RealtimeClient.instance) {
      RealtimeClient.instance.disconnectAll();
      RealtimeClient.instance = null;
    }
  }

  /**
   * Get the Supabase client instance
   */
  public getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get a channel by name, creating it if it doesn't exist
   */
  public getChannel(channelName: RealtimeChannelName): RealtimeChannel {
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      return existingChannel;
    }

    const channel = this.supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // Don't receive own broadcasts
          ack: true, // Require acknowledgment
        },
        presence: {
          key: '', // Will be set per user
        },
      },
    });

    this.channels.set(channelName, channel);
    this.initializeConnectionState(channelName);

    return channel;
  }

  /**
   * Subscribe to a channel
   */
  public async subscribe(
    channelName: RealtimeChannelName,
    callbacks?: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: Error) => void;
    },
  ): Promise<RealtimeChannel> {
    const channel = this.getChannel(channelName);
    const state = this.getConnectionState(channelName);

    // Update state to connecting
    this.updateConnectionState(channelName, { state: 'connecting' });

    return new Promise((resolve, reject) => {
      channel
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            this.updateConnectionState(channelName, {
              state: 'connected',
              channel,
              connectedAt: new Date(),
              reconnectAttempts: 0,
            });

            // NOTE: Heartbeat removed - Supabase Realtime has built-in WebSocket heartbeats

            callbacks?.onConnect?.();
            resolve(channel);
          } else if (status === 'CHANNEL_ERROR') {
            const connectionError = new RealtimeConnectionError(
              error?.message || 'Failed to subscribe to channel',
              channelName,
            );

            this.updateConnectionState(channelName, {
              state: 'error',
              error: connectionError,
            });

            callbacks?.onError?.(connectionError);
            reject(connectionError);
          } else if (status === 'TIMED_OUT') {
            const timeoutError = new RealtimeConnectionError(
              'Channel subscription timed out',
              channelName,
            );

            this.updateConnectionState(channelName, {
              state: 'error',
              error: timeoutError,
            });

            callbacks?.onError?.(timeoutError);
            reject(timeoutError);
          } else if (status === 'CLOSED') {
            this.updateConnectionState(channelName, {
              state: 'disconnected',
            });

            callbacks?.onDisconnect?.();
          }
        });
    });
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channelName: RealtimeChannelName): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      return;
    }

    await this.supabase.removeChannel(channel);
    this.channels.delete(channelName);
    this.connectionStates.delete(channelName);
  }

  /**
   * Disconnect from all channels
   */
  public async disconnectAll(): Promise<void> {
    const channelNames = Array.from(this.channels.keys());
    await Promise.all(
      channelNames.map((name) => this.unsubscribe(name as RealtimeChannelName)),
    );
  }

  /**
   * Broadcast an event to a channel
   */
  public async broadcast<T = any>(
    channelName: RealtimeChannelName,
    eventName: string,
    payload: T,
  ): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new RealtimeConnectionError(
        `Channel ${channelName} is not subscribed`,
        channelName,
      );
    }

    const state = this.getConnectionState(channelName);
    if (state.state !== 'connected') {
      throw new RealtimeConnectionError(
        `Channel ${channelName} is not connected`,
        channelName,
      );
    }

    const result = await channel.send({
      type: 'broadcast',
      event: eventName,
      payload,
    });

    if (result !== 'ok') {
      throw new RealtimeConnectionError(
        `Failed to broadcast to channel ${channelName}`,
        channelName,
      );
    }
  }

  /**
   * Track presence on a channel
   */
  public async trackPresence(
    channelName: RealtimeChannelName,
    state: Record<string, any>,
  ): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      throw new RealtimeConnectionError(
        `Channel ${channelName} is not subscribed`,
        channelName,
      );
    }

    await channel.track(state);
  }

  /**
   * Untrack presence on a channel
   */
  public async untrackPresence(channelName: RealtimeChannelName): Promise<void> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      return;
    }

    await channel.untrack();
  }

  /**
   * Get connection state for a channel
   */
  public getConnectionState(channelName: RealtimeChannelName): RealtimeConnectionState {
    const state = this.connectionStates.get(channelName);
    if (!state) {
      this.initializeConnectionState(channelName);
      return this.connectionStates.get(channelName)!;
    }
    return state;
  }

  /**
   * Check if a channel is connected
   */
  public isConnected(channelName: RealtimeChannelName): boolean {
    const state = this.getConnectionState(channelName);
    return state.state === 'connected';
  }

  /**
   * Initialize connection state for a channel
   */
  private initializeConnectionState(channelName: RealtimeChannelName): void {
    this.connectionStates.set(channelName, {
      state: 'disconnected',
      reconnectAttempts: 0,
    });
  }

  /**
   * Update connection state for a channel
   */
  private updateConnectionState(
    channelName: RealtimeChannelName,
    updates: Partial<RealtimeConnectionState>,
  ): void {
    const currentState = this.getConnectionState(channelName);
    this.connectionStates.set(channelName, {
      ...currentState,
      ...updates,
    });
  }

  /**
   * NOTE: Custom heartbeat methods removed
   *
   * Supabase Realtime uses Phoenix Channels which has built-in WebSocket heartbeat
   * functionality. Custom application-level heartbeats are redundant and waste bandwidth.
   *
   * The WebSocket protocol itself includes ping/pong frames for connection health checking,
   * and Phoenix Channels implements additional heartbeat logic at the protocol level.
   * This provides more reliable connection management than application-level pings.
   */
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the singleton Realtime client instance
 */
export function getRealtimeClient(): RealtimeClient {
  return RealtimeClient.getInstance();
}

/**
 * Get the Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
  return getRealtimeClient().getSupabaseClient();
}
