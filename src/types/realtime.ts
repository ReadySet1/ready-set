/**
 * Realtime Type Definitions
 *
 * TypeScript interfaces for Supabase Realtime channels, payloads, and configurations.
 * These types support driver location tracking, delivery assignments, and bidirectional messaging.
 *
 * @see https://supabase.com/docs/guides/realtime
 */

import type { LocationUpdate, DeliveryTracking } from './tracking';
import type { DriverStatus } from './user';

/**
 * Location update payload broadcast over WebSocket
 * Represents a driver's current GPS position and movement data
 */
export interface RealtimeLocationPayload {
  /** Unique driver identifier */
  driver_id: string;

  /** Latitude coordinate (-90 to 90) */
  latitude: number;

  /** Longitude coordinate (-180 to 180) */
  longitude: number;

  /** GPS accuracy in meters */
  accuracy?: number;

  /** Speed in meters per second */
  speed?: number;

  /** Heading/bearing in degrees (0-360) */
  heading?: number;

  /** Altitude in meters above sea level */
  altitude?: number;

  /** Device battery level (0-100) */
  battery_level?: number;

  /** Type of activity detected (e.g., 'still', 'walking', 'driving') */
  activity_type?: string;

  /** Whether the driver is currently moving */
  is_moving?: boolean;

  /** ISO 8601 timestamp of location update */
  timestamp: string;
}

/**
 * Delivery assignment payload broadcast when driver receives new delivery
 */
export interface RealtimeDeliveryPayload {
  /** Unique delivery identifier */
  delivery_id: string;

  /** Assigned driver ID */
  driver_id: string;

  /** Current delivery status (using DriverStatus enum from @/types/user) */
  status: DriverStatus;

  /** Pickup location coordinates */
  pickup_location: {
    lat: number;
    lng: number;
  };

  /** Delivery destination coordinates */
  delivery_location: {
    lat: number;
    lng: number;
  };

  /** Estimated arrival time (ISO 8601) */
  estimated_arrival?: string;

  /** Assignment timestamp (ISO 8601) */
  assigned_at: string;
}

/**
 * Message payload for admin-driver bidirectional communication
 */
export interface RealtimeMessagePayload {
  /** Unique message identifier */
  message_id: string;

  /** Sender user ID */
  from: string;

  /** Recipient user ID or 'all' for broadcast */
  to: string | 'all';

  /** Message content */
  content: string;

  /** Message priority level */
  priority: 'normal' | 'urgent';

  /** Message timestamp (ISO 8601) */
  timestamp: string;

  /** Optional: Message read status */
  read?: boolean;

  /** Optional: Message delivery status */
  delivered?: boolean;
}

/**
 * Presence state for tracking online/offline drivers
 * Key is user ID, value is presence data
 */
export interface RealtimePresenceState {
  [userId: string]: Array<{
    /** Driver unique identifier */
    driver_id: string;

    /** When driver came online (ISO 8601) */
    online_at: string;

    /** Current driver status */
    status: 'active' | 'idle' | 'offline';

    /** Optional: Additional presence metadata */
    [key: string]: unknown;
  }>;
}

/**
 * Callback function type for channel events
 */
export type ChannelEventCallback<T = unknown> = (payload: T) => void;

/**
 * Configuration for DriverLocationChannel
 */
export interface DriverLocationChannelConfig {
  /** Driver ID (required for drivers, optional for admins) */
  driverId?: string;

  /** Enable presence tracking for this driver */
  presence?: boolean;

  /** Callback when successfully connected */
  onConnect?: () => void;

  /** Callback when disconnected */
  onDisconnect?: () => void;

  /** Callback when receiving location update (admin view) */
  onLocationUpdate?: ChannelEventCallback<RealtimeLocationPayload>;

  /** Callback when receiving batch location updates */
  onBatchUpdate?: ChannelEventCallback<RealtimeLocationPayload[]>;

  /** Callback when presence state changes */
  onPresenceChange?: ChannelEventCallback<RealtimePresenceState>;

  /** Callback when driver comes online */
  onDriverOnline?: ChannelEventCallback<unknown>;

  /** Callback when driver goes offline */
  onDriverOffline?: ChannelEventCallback<unknown>;

  /** Callback for error handling */
  onError?: (error: Error) => void;
}

/**
 * Configuration for DeliveryChannel
 */
export interface DeliveryChannelConfig {
  /** Driver ID to filter delivery assignments */
  driverId?: string;

  /** Callback when delivery is assigned */
  onDeliveryAssigned?: ChannelEventCallback<RealtimeDeliveryPayload>;

  /** Callback when delivery status changes */
  onStatusChanged?: ChannelEventCallback<RealtimeDeliveryPayload>;

  /** Callback when delivery is completed */
  onDeliveryCompleted?: ChannelEventCallback<RealtimeDeliveryPayload>;

  /** Callback for error handling */
  onError?: (error: Error) => void;
}

/**
 * Configuration for MessagingChannel
 */
export interface MessagingChannelConfig {
  /** Current user ID (driver or admin) */
  userId: string;

  /** Callback when message is received */
  onMessageReceived?: ChannelEventCallback<RealtimeMessagePayload>;

  /** Callback when message is delivered (acknowledgment) */
  onMessageDelivered?: ChannelEventCallback<{ message_id: string }>;

  /** Callback when message is read by recipient */
  onMessageRead?: ChannelEventCallback<{ message_id: string }>;

  /** Callback for error handling */
  onError?: (error: Error) => void;
}

/**
 * WebSocket connection status
 */
export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

/**
 * Connection state for tracking WebSocket health
 */
export interface RealtimeConnectionState {
  /** Current connection status */
  status: RealtimeConnectionStatus;

  /** Number of reconnection attempts */
  reconnectAttempts: number;

  /** Last successful connection timestamp */
  lastConnected?: Date;

  /** Last error message */
  lastError?: string;

  /** Round-trip latency in milliseconds */
  latency?: number;
}

/**
 * Options for initializing Realtime channels
 */
export interface RealtimeInitOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;

  /** Initial reconnection delay in milliseconds */
  reconnectDelay?: number;

  /** Maximum reconnection delay in milliseconds */
  maxReconnectDelay?: number;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Enable presence tracking */
  enablePresence?: boolean;
}

/**
 * Batch location update for optimizing multiple driver updates
 */
export interface BatchLocationUpdate {
  /** Array of location updates from multiple drivers */
  updates: RealtimeLocationPayload[];

  /** Batch timestamp (ISO 8601) */
  timestamp: string;

  /** Number of drivers in batch */
  count: number;
}

/**
 * Health check result for WebSocket connection
 */
export interface RealtimeHealthCheck {
  /** Whether connection is healthy */
  isHealthy: boolean;

  /** Round-trip latency in milliseconds */
  latency?: number;

  /** Error message if unhealthy */
  error?: string;

  /** Timestamp of health check */
  timestamp: Date;
}

/**
 * Metrics for monitoring Realtime performance
 */
export interface RealtimeMetrics {
  /** Total messages sent */
  messagesSent: number;

  /** Total messages received */
  messagesReceived: number;

  /** Average latency in milliseconds */
  averageLatency: number;

  /** Number of reconnections */
  reconnections: number;

  /** Total connection uptime in seconds */
  uptime: number;

  /** Number of errors encountered */
  errors: number;
}

/**
 * Event types for Realtime monitoring and debugging
 */
export type RealtimeEventType =
  | 'connection:open'
  | 'connection:close'
  | 'connection:error'
  | 'message:sent'
  | 'message:received'
  | 'presence:sync'
  | 'presence:join'
  | 'presence:leave'
  | 'reconnect:attempt'
  | 'reconnect:success'
  | 'reconnect:failed';

/**
 * Event data for Realtime monitoring
 */
export interface RealtimeEvent {
  /** Event type */
  type: RealtimeEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Associated channel name */
  channel?: string;

  /** Event payload data */
  data?: unknown;

  /** Error information if applicable */
  error?: Error;
}
