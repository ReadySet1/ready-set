/**
 * Supabase Realtime Client
 *
 * Singleton client for managing Supabase Realtime connections.
 * Provides a centralized interface for all real-time communication.
 */

import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  REALTIME_CHANNELS,
  type RealtimeChannelName,
  type ConnectionState,
  type RealtimeConnectionState,
  RealtimeConnectionError,
  RealtimeAuthenticationError,
  RealtimeValidationError,
  REALTIME_EVENTS,
} from './types';
import { realtimeLogger } from '../logging/realtime-logger';
import { validatePayload, PayloadValidationError, PayloadSizeError } from './schemas';
import { locationRateLimiter, RateLimitExceededError } from '../rate-limiting/location-rate-limiter';
import { CONNECTION_CONFIG } from '@/constants/realtime-config';
import { createClient as createBrowserClient } from '@/utils/supabase/client';

// ============================================================================
// Client Configuration
// ============================================================================

// Environment validation is handled by the browser client in @/utils/supabase/client

// ============================================================================
// Authorization
// ============================================================================

export interface UserContext {
  userId: string;
  userType: 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK' | 'CLIENT' | 'VENDOR';
  driverId?: string;
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Channel access rules based on user type
 */
const CHANNEL_ACCESS_RULES: Record<string, string[]> = {
  [REALTIME_CHANNELS.DRIVER_LOCATIONS]: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'VENDOR', 'CLIENT'],
  [REALTIME_CHANNELS.DRIVER_STATUS]: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK', 'VENDOR', 'CLIENT'],
  [REALTIME_CHANNELS.ADMIN_COMMANDS]: ['ADMIN', 'SUPER_ADMIN'],
  [REALTIME_CHANNELS.DELIVERIES]: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
};

/**
 * Broadcast access rules based on user type and event
 */
const BROADCAST_ACCESS_RULES: Record<string, string[]> = {
  'driver:location': ['DRIVER'],
  'driver:status': ['DRIVER'],
  'admin:assign-delivery': ['ADMIN', 'SUPER_ADMIN'],
  'admin:message': ['ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
  // Delivery status can be broadcast by drivers (updating their delivery status)
  // and by admins/helpdesk (via API routes)
  'delivery:status': ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
  'delivery:status:updated': ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
};

/**
 * Check if user has access to a channel
 */
function canAccessChannel(channelName: string, userType: string): boolean {
  const allowedRoles = CHANNEL_ACCESS_RULES[channelName];
  if (!allowedRoles) {
    // If no rules defined, default to deny
    return false;
  }
  return allowedRoles.includes(userType);
}

/**
 * Check if user can broadcast a specific event
 */
function canBroadcastEvent(eventName: string, userType: string): boolean {
  const allowedRoles = BROADCAST_ACCESS_RULES[eventName];
  if (!allowedRoles) {
    // If no rules defined, allow (backwards compatibility)
    return true;
  }
  return allowedRoles.includes(userType);
}

/**
 * Fetch user context from database when not provided
 */
async function fetchUserContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserContext> {
  // Fetch user type from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('type')
    .eq('id', userId)
    .single();

  if (profileError || !profile || !profile.type) {
    realtimeLogger.error('Failed to fetch user profile', {
      error: profileError,
      metadata: { userId },
    });
    throw new UnauthorizedError(
      'Unable to verify user permissions. Profile not found.'
    );
  }

  const userType = profile.type as 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK' | 'CLIENT' | 'VENDOR';

  // If user is a driver, fetch driver ID
  let driverId: string | undefined;
  if (userType === 'DRIVER') {
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('profile_id', userId)
      .single();

    if (driverError || !driver) {
      realtimeLogger.warn('Driver profile found but no driver record exists', {
        error: driverError,
        metadata: { userId },
      });
      // Don't throw - allow DRIVER user type without driver record
      // They may be a driver in the system but not yet assigned
    } else {
      driverId = driver.id;
    }
  }

  return {
    userId,
    userType,
    driverId,
  };
}

// ============================================================================
// Realtime Client Class
// ============================================================================

export class RealtimeClient {
  private static instance: RealtimeClient | null = null;
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionStates: Map<string, RealtimeConnectionState> = new Map();
  private channelLastUsed: Map<string, number> = new Map(); // Track last access time for LRU eviction
  private readonly MAX_CHANNELS = 100;

  private constructor() {
    // Use the browser client that has access to auth session cookies
    this.supabase = createBrowserClient();
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
   * Enforces MAX_CHANNELS limit with LRU eviction
   */
  public getChannel(channelName: RealtimeChannelName): RealtimeChannel {
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      // Update last used timestamp for LRU tracking
      this.channelLastUsed.set(channelName, Date.now());
      return existingChannel;
    }

    // Enforce maximum channels limit with LRU eviction
    if (this.channels.size >= this.MAX_CHANNELS) {
      // Find the least recently used channel
      let lruChannelName: string | null = null;
      let oldestTime = Infinity;

      for (const [name, lastUsed] of this.channelLastUsed.entries()) {
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed;
          lruChannelName = name;
        }
      }

      if (lruChannelName) {
        // Evict the LRU channel
        realtimeLogger.warn('Evicting least recently used channel', {
          metadata: {
            evictedChannel: lruChannelName,
            lastUsed: new Date(oldestTime).toISOString(),
            currentChannels: this.channels.size,
            maxChannels: this.MAX_CHANNELS,
          },
        });

        // Unsubscribe and remove the LRU channel
        const lruChannel = this.channels.get(lruChannelName);
        if (lruChannel) {
          lruChannel.unsubscribe().catch((error) => {
            realtimeLogger.error('Error unsubscribing LRU channel', {
              error,
              metadata: {
                channel: lruChannelName,
              },
            });
          });
        }

        this.channels.delete(lruChannelName);
        this.connectionStates.delete(lruChannelName);
        this.channelLastUsed.delete(lruChannelName);
      } else {
        // Fallback: throw error if we can't find an LRU channel
        realtimeLogger.error('Maximum channels exceeded with no LRU candidate', {
          metadata: {
            currentChannels: this.channels.size,
            maxChannels: this.MAX_CHANNELS,
          },
        });
        throw new RealtimeConnectionError(
          `Maximum ${this.MAX_CHANNELS} channels exceeded. Please unsubscribe from unused channels.`,
          channelName,
        );
      }
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
    this.channelLastUsed.set(channelName, Date.now()); // Track creation time for LRU
    this.initializeConnectionState(channelName);

    realtimeLogger.connection('created', channelName, {
      totalChannels: this.channels.size,
    });

    return channel;
  }

  /**
   * Subscribe to a channel
   * Validates user has permission to access the channel
   */
  public async subscribe(
    channelName: RealtimeChannelName,
    userContext?: UserContext,
    callbacks?: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: Error) => void;
    },
  ): Promise<RealtimeChannel> {
    // Get or fetch user context for authorization
    let effectiveUserContext: UserContext;

    if (!userContext) {
      // Get authenticated user
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        realtimeLogger.error('User must be authenticated to subscribe', { error });
        throw new UnauthorizedError(
          'User must be authenticated to subscribe to channels'
        );
      }

      // Fetch user context from database
      realtimeLogger.debug('Fetching user context for authorization', {
        channelName,
        metadata: { userId: user.id },
      });
      effectiveUserContext = await fetchUserContext(this.supabase, user.id);
    } else {
      effectiveUserContext = userContext;
    }

    // Validate user has access to this channel
    if (!canAccessChannel(channelName, effectiveUserContext.userType)) {
      realtimeLogger.error('User does not have access to channel', {
        channelName,
        metadata: {
          userType: effectiveUserContext.userType,
        },
      });
      throw new UnauthorizedError(
        `Access denied to channel: ${channelName}. User type ${effectiveUserContext.userType} does not have permission.`
      );
    }

    const channel = this.getChannel(channelName);
    const state = this.getConnectionState(channelName);

    // Update state to connecting
    this.updateConnectionState(channelName, { state: 'connecting' });

    realtimeLogger.connection('connecting', channelName, {
      userType: effectiveUserContext.userType,
    });

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

            // Track successful connection in metrics
            this.recordConnection(channelName);

            realtimeLogger.connection('subscribed', channelName);

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

            // Track error in metrics
            this.recordError(channelName, connectionError);

            realtimeLogger.error('Channel subscription error', {
              channelName,
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

            // Track error in metrics
            this.recordError(channelName, timeoutError);

            // Log as warning since timeout often triggers graceful SSE fallback
            realtimeLogger.warn('Channel subscription timed out - may fallback to SSE', {
              channelName,
            });

            callbacks?.onError?.(timeoutError);
            reject(timeoutError);
          } else if (status === 'CLOSED') {
            this.updateConnectionState(channelName, {
              state: 'disconnected',
            });

            // Track disconnection in metrics
            this.recordDisconnection(channelName);

            realtimeLogger.connection('closed', channelName);

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

    // Track disconnection in metrics before removing state
    this.recordDisconnection(channelName);

    await this.supabase.removeChannel(channel);
    this.channels.delete(channelName);
    this.connectionStates.delete(channelName);
    // MEMORY LEAK FIX: Clean up LRU tracking map to prevent memory growth
    this.channelLastUsed.delete(channelName);
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
   * Validates user authorization, rate limiting, payload with Zod schemas, checks size limits, and sanitizes input
   */
  public async broadcast<T = unknown>(
    channelName: RealtimeChannelName,
    eventName: string,
    payload: T,
    userContext?: UserContext,
  ): Promise<void> {
    try {
      // Get or fetch user context for authorization
      let effectiveUserContext: UserContext;

      if (!userContext) {
        // Get authenticated user
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error || !user) {
          realtimeLogger.error('User must be authenticated to broadcast', { error });
          throw new UnauthorizedError(
            'User must be authenticated to broadcast events'
          );
        }

        // Fetch user context from database
        realtimeLogger.debug('Fetching user context for broadcast authorization', {
          eventType: eventName,
          metadata: { userId: user.id },
        });
        effectiveUserContext = await fetchUserContext(this.supabase, user.id);
      } else {
        effectiveUserContext = userContext;
      }

      // Check rate limiting for driver location updates
      if (eventName === REALTIME_EVENTS.DRIVER_LOCATION_UPDATE && effectiveUserContext.driverId) {
        const rateLimitResult = locationRateLimiter.checkLimit(effectiveUserContext.driverId);
        if (!rateLimitResult.allowed) {
          realtimeLogger.warn('Rate limit exceeded for driver location update', {
            driverId: effectiveUserContext.driverId,
            metadata: {
              retryAfter: rateLimitResult.retryAfter,
            },
          });
          throw new RateLimitExceededError(
            effectiveUserContext.driverId,
            rateLimitResult.retryAfter || 0
          );
        }
      }

      // Check if user can broadcast this event type
      if (!canBroadcastEvent(eventName, effectiveUserContext.userType)) {
        realtimeLogger.error('User not authorized to broadcast event', {
          eventType: eventName,
          metadata: {
            userType: effectiveUserContext.userType,
          },
        });
        throw new UnauthorizedError(
          `User type ${effectiveUserContext.userType} is not authorized to broadcast ${eventName}`
        );
      }

      // For driver events, validate driver ID matches
      if (eventName.startsWith('driver:')) {
        const payloadWithDriverId = payload as any;
        if (payloadWithDriverId.driverId && effectiveUserContext.driverId) {
          if (payloadWithDriverId.driverId !== effectiveUserContext.driverId) {
            realtimeLogger.error('Driver ID mismatch in payload', {
              eventType: eventName,
              driverId: effectiveUserContext.driverId,
              metadata: {
                payloadDriverId: payloadWithDriverId.driverId,
              },
            });
            throw new UnauthorizedError(
              'Driver ID in payload does not match authenticated user'
            );
          }
        }
      }

      // Validate payload with Zod (includes size check and sanitization)
      const validatedPayload = validatePayload(eventName, payload);

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

      realtimeLogger.broadcast(eventName, channelName, {
        payloadSize: JSON.stringify(validatedPayload).length,
        userType: effectiveUserContext.userType,
      });

      const result = await channel.send({
        type: 'broadcast',
        event: eventName,
        payload: validatedPayload,
      });

      if (result !== 'ok') {
        throw new RealtimeConnectionError(
          `Failed to broadcast to channel ${channelName}`,
          channelName,
        );
      }

      // Track successful message send in metrics
      this.recordMessageSent(channelName);

      // Record successful broadcast for rate limiting
      if (eventName === REALTIME_EVENTS.DRIVER_LOCATION_UPDATE && effectiveUserContext.driverId) {
        locationRateLimiter.recordUpdate(effectiveUserContext.driverId);
      }

      realtimeLogger.debug(`Broadcast sent successfully: ${eventName}`, {
        channelName,
        eventType: eventName,
      });
    } catch (error) {
      // Track error in metrics
      if (error instanceof Error) {
        this.recordError(channelName, error);
      }

      if (error instanceof PayloadValidationError) {
        realtimeLogger.error('Payload validation failed', {
          eventType: eventName,
          error,
          metadata: {
            errors: error.errors.issues,
          },
        });
        throw new RealtimeValidationError(error.message, eventName);
      }

      if (error instanceof PayloadSizeError) {
        realtimeLogger.error('Payload size exceeded', {
          eventType: eventName,
          error,
          metadata: {
            size: error.size,
            maxSize: error.maxSize,
          },
        });
        throw new RealtimeValidationError(error.message, eventName);
      }

      throw error;
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
   * Initialize connection state for a channel with metrics
   */
  private initializeConnectionState(channelName: RealtimeChannelName): void {
    this.connectionStates.set(channelName, {
      state: 'disconnected',
      reconnectAttempts: 0,
      metrics: {
        totalConnections: 0,
        totalDisconnections: 0,
        totalErrors: 0,
        messagesSent: 0,
        messagesReceived: 0,
        totalUptimeMs: 0,
      },
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
   * Record a successful connection in metrics
   */
  private recordConnection(channelName: RealtimeChannelName): void {
    const state = this.getConnectionState(channelName);
    this.updateConnectionState(channelName, {
      metrics: {
        ...state.metrics,
        totalConnections: state.metrics.totalConnections + 1,
      },
    });
  }

  /**
   * Record a disconnection in metrics
   */
  private recordDisconnection(channelName: RealtimeChannelName): void {
    const state = this.getConnectionState(channelName);

    // Calculate uptime if we have a connectedAt timestamp
    let uptimeMs = 0;
    if (state.connectedAt) {
      uptimeMs = Date.now() - state.connectedAt.getTime();
    }

    this.updateConnectionState(channelName, {
      metrics: {
        ...state.metrics,
        totalDisconnections: state.metrics.totalDisconnections + 1,
        totalUptimeMs: state.metrics.totalUptimeMs + uptimeMs,
      },
    });
  }

  /**
   * Record an error in metrics
   */
  private recordError(channelName: RealtimeChannelName, error: Error): void {
    const state = this.getConnectionState(channelName);
    this.updateConnectionState(channelName, {
      metrics: {
        ...state.metrics,
        totalErrors: state.metrics.totalErrors + 1,
        lastError: error,
        lastErrorAt: new Date(),
      },
    });
  }

  /**
   * Record a sent message in metrics
   */
  private recordMessageSent(channelName: RealtimeChannelName): void {
    const state = this.getConnectionState(channelName);
    this.updateConnectionState(channelName, {
      metrics: {
        ...state.metrics,
        messagesSent: state.metrics.messagesSent + 1,
      },
    });
  }

  /**
   * Record a received message in metrics
   */
  private recordMessageReceived(channelName: RealtimeChannelName): void {
    const state = this.getConnectionState(channelName);
    this.updateConnectionState(channelName, {
      metrics: {
        ...state.metrics,
        messagesReceived: state.metrics.messagesReceived + 1,
      },
    });
  }

  /**
   * Get connection metrics for monitoring and debugging
   */
  public getConnectionMetrics(channelName: RealtimeChannelName) {
    const state = this.getConnectionState(channelName);
    const metrics = state.metrics;

    // Calculate current session uptime if connected
    let currentUptimeMs = metrics.totalUptimeMs;
    if (state.state === 'connected' && state.connectedAt) {
      currentUptimeMs += Date.now() - state.connectedAt.getTime();
    }

    // Calculate reconnection frequency (reconnects per hour)
    const reconnectFrequency = currentUptimeMs > 0
      ? (state.reconnectAttempts / (currentUptimeMs / (1000 * 60 * 60)))
      : 0;

    // Calculate error rate (errors per 100 messages)
    const totalMessages = metrics.messagesSent + metrics.messagesReceived;
    const errorRate = totalMessages > 0
      ? (metrics.totalErrors / totalMessages) * 100
      : 0;

    return {
      ...metrics,
      currentUptimeMs,
      reconnectFrequency,
      errorRate,
      state: state.state,
      reconnectAttempts: state.reconnectAttempts,
    };
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
