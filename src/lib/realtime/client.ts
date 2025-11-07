/**
 * Supabase Realtime Client
 *
 * Singleton client for managing Supabase Realtime connections.
 * Provides a centralized interface for all real-time communication.
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
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

// ============================================================================
// Client Configuration
// ============================================================================

// Validate environment variables with Zod
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    .regex(
      /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      'NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT token',
    ),
});

// Validate and extract environment variables at module load time
function validateEnvironment() {
  try {
    const result = EnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

    if (!result.success) {
      const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      realtimeLogger.error('Invalid Supabase environment configuration', { errors });
      throw new RealtimeAuthenticationError(
        `Supabase environment configuration is invalid: ${errors}. ` +
        'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are properly set in your .env file.'
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof RealtimeAuthenticationError) {
      throw error;
    }
    realtimeLogger.error('Failed to validate environment variables', { error });
    throw new RealtimeAuthenticationError(
      'Failed to load Supabase configuration. Please check your environment variables.'
    );
  }
}

// Validate and load environment variables
const env = validateEnvironment();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Realtime configuration
// NOTE: Heartbeat removed - Supabase Realtime has built-in WebSocket heartbeats
const REALTIME_CONFIG = {
  reconnectDelay: 1000, // 1 second
  reconnectDelayMax: 5000, // 5 seconds
  reconnectAttempts: Infinity,
  timeout: 10000, // 10 seconds
};

// ============================================================================
// Authorization
// ============================================================================

export interface UserContext {
  userId: string;
  userType: 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK' | 'CLIENT';
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
  [REALTIME_CHANNELS.DRIVER_LOCATIONS]: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
  [REALTIME_CHANNELS.DRIVER_STATUS]: ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK'],
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

// ============================================================================
// Realtime Client Class
// ============================================================================

export class RealtimeClient {
  private static instance: RealtimeClient | null = null;
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionStates: Map<string, RealtimeConnectionState> = new Map();
  private readonly MAX_CHANNELS = 100;

  private constructor() {
    // Environment variables are validated at module load time
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
   * Enforces MAX_CHANNELS limit to prevent memory leaks
   */
  public getChannel(channelName: RealtimeChannelName): RealtimeChannel {
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      return existingChannel;
    }

    // Enforce maximum channels limit
    if (this.channels.size >= this.MAX_CHANNELS) {
      realtimeLogger.error('Maximum channels exceeded', {
        currentChannels: this.channels.size,
        maxChannels: this.MAX_CHANNELS,
      });
      throw new RealtimeConnectionError(
        `Maximum ${this.MAX_CHANNELS} channels exceeded. Please unsubscribe from unused channels.`,
        channelName,
      );
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

    realtimeLogger.connection('Channel created', {
      channel: channelName,
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
    // Get authenticated user if not provided
    if (!userContext) {
      const { data: { user }, error } = await this.supabase.auth.getUser();

      if (error || !user) {
        realtimeLogger.error('User must be authenticated to subscribe', { error });
        throw new UnauthorizedError(
          'User must be authenticated to subscribe to channels'
        );
      }

      // For now, we can't get the user type from the token alone
      // This would need to be passed from the calling code or fetched from the database
      realtimeLogger.warn('User context not provided, skipping authorization check', {
        channel: channelName,
        userId: user.id,
      });
    } else {
      // Validate user has access to this channel
      if (!canAccessChannel(channelName, userContext.userType)) {
        realtimeLogger.error('User does not have access to channel', {
          channel: channelName,
          userType: userContext.userType,
        });
        throw new UnauthorizedError(
          `Access denied to channel: ${channelName}. User type ${userContext.userType} does not have permission.`
        );
      }
    }

    const channel = this.getChannel(channelName);
    const state = this.getConnectionState(channelName);

    // Update state to connecting
    this.updateConnectionState(channelName, { state: 'connecting' });

    realtimeLogger.connection('Subscribing to channel', {
      channel: channelName,
      userType: userContext?.userType,
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

            realtimeLogger.connection('Channel subscribed', {
              channel: channelName,
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

            realtimeLogger.error('Channel subscription error', {
              channel: channelName,
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

            realtimeLogger.error('Channel subscription timed out', {
              channel: channelName,
            });

            callbacks?.onError?.(timeoutError);
            reject(timeoutError);
          } else if (status === 'CLOSED') {
            this.updateConnectionState(channelName, {
              state: 'disconnected',
            });

            realtimeLogger.connection('Channel closed', {
              channel: channelName,
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
   * Validates user authorization, rate limiting, payload with Zod schemas, checks size limits, and sanitizes input
   */
  public async broadcast<T = unknown>(
    channelName: RealtimeChannelName,
    eventName: string,
    payload: T,
    userContext?: UserContext,
  ): Promise<void> {
    try {
      // Check user authorization if context provided
      if (userContext) {
        // Check rate limiting for driver location updates
        if (eventName === REALTIME_EVENTS.DRIVER_LOCATION_UPDATE && userContext.driverId) {
          const rateLimitResult = locationRateLimiter.checkLimit(userContext.driverId);
          if (!rateLimitResult.allowed) {
            realtimeLogger.warn('Rate limit exceeded for driver location update', {
              driverId: userContext.driverId,
              retryAfter: rateLimitResult.retryAfter,
            });
            throw new RateLimitExceededError(
              userContext.driverId,
              rateLimitResult.retryAfter || 0
            );
          }
        }

        // Check if user can broadcast this event type
        if (!canBroadcastEvent(eventName, userContext.userType)) {
          realtimeLogger.error('User not authorized to broadcast event', {
            eventName,
            userType: userContext.userType,
          });
          throw new UnauthorizedError(
            `User type ${userContext.userType} is not authorized to broadcast ${eventName}`
          );
        }

        // For driver events, validate driver ID matches
        if (eventName.startsWith('driver:')) {
          const payloadWithDriverId = payload as any;
          if (payloadWithDriverId.driverId && userContext.driverId) {
            if (payloadWithDriverId.driverId !== userContext.driverId) {
              realtimeLogger.error('Driver ID mismatch in payload', {
                eventName,
                payloadDriverId: payloadWithDriverId.driverId,
                contextDriverId: userContext.driverId,
              });
              throw new UnauthorizedError(
                'Driver ID in payload does not match authenticated user'
              );
            }
          }
        }
      } else {
        // If no user context provided, get auth user to at least verify they're logged in
        const { data: { user }, error } = await this.supabase.auth.getUser();
        if (error || !user) {
          realtimeLogger.error('User must be authenticated to broadcast', { error });
          throw new UnauthorizedError(
            'User must be authenticated to broadcast events'
          );
        }

        realtimeLogger.warn('User context not provided for broadcast, skipping authorization', {
          eventName,
          userId: user.id,
        });
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

      realtimeLogger.broadcast('Sending broadcast', {
        channel: channelName,
        event: eventName,
        payloadSize: JSON.stringify(validatedPayload).length,
        userType: userContext?.userType,
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

      // Record successful broadcast for rate limiting
      if (eventName === REALTIME_EVENTS.DRIVER_LOCATION_UPDATE && userContext?.driverId) {
        locationRateLimiter.recordUpdate(userContext.driverId);
      }

      realtimeLogger.broadcast('Broadcast sent successfully', {
        channel: channelName,
        event: eventName,
      });
    } catch (error) {
      if (error instanceof PayloadValidationError) {
        realtimeLogger.error('Payload validation failed', {
          eventName,
          errors: error.errors.errors,
        });
        throw new RealtimeValidationError(error.message, eventName);
      }

      if (error instanceof PayloadSizeError) {
        realtimeLogger.error('Payload size exceeded', {
          eventName,
          size: error.size,
          maxSize: error.maxSize,
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
