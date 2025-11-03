/**
 * Supabase Realtime Event Types
 *
 * Defines all event types and payloads for real-time communication
 * between drivers, admins, and the server using Supabase Realtime.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// Channel Names
// ============================================================================

export const REALTIME_CHANNELS = {
  DRIVER_LOCATIONS: 'driver-locations',
  DRIVER_STATUS: 'driver-status',
  ADMIN_COMMANDS: 'admin-commands',
  DELIVERIES: 'deliveries',
} as const;

export type RealtimeChannelName = (typeof REALTIME_CHANNELS)[keyof typeof REALTIME_CHANNELS];

// ============================================================================
// Event Names
// ============================================================================

export const REALTIME_EVENTS = {
  // Driver → Server → Admins
  DRIVER_LOCATION_UPDATE: 'driver:location',
  DRIVER_LOCATION_UPDATED: 'driver:location:updated',

  // Driver → Server → Admins (Status)
  DRIVER_STATUS_UPDATE: 'driver:status',
  DRIVER_STATUS_UPDATED: 'driver:status:updated',

  // Admin → Server → Driver
  ADMIN_ASSIGN_DELIVERY: 'admin:assign-delivery',
  DELIVERY_ASSIGNED: 'delivery:assigned',

  // Admin → Server → Driver(s)
  ADMIN_MESSAGE: 'admin:message',
  ADMIN_MESSAGE_RECEIVED: 'admin:message:received',

  // Bidirectional heartbeat
  PING: 'ping',
  PONG: 'pong',

  // Presence events
  DRIVER_ONLINE: 'driver:online',
  DRIVER_OFFLINE: 'driver:offline',
  ADMIN_ONLINE: 'admin:online',
  ADMIN_OFFLINE: 'admin:offline',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

// ============================================================================
// Location Update Events
// ============================================================================

export interface DriverLocationPayload {
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  batteryLevel?: number | null;
  isMoving?: boolean;
  activityType?: 'walking' | 'driving' | 'stationary' | null;
  timestamp: string; // ISO 8601
}

export interface DriverLocationUpdatedPayload extends DriverLocationPayload {
  driverId: string;
  driverName?: string;
  vehicleNumber?: string;
}

// ============================================================================
// Driver Status Events
// ============================================================================

export type DriverStatus = 'active' | 'on_break' | 'off_duty' | 'unavailable';
export type BreakType = 'rest' | 'meal' | 'fuel' | 'emergency';

export interface DriverStatusPayload {
  status: DriverStatus;
  shiftId?: string;
  breakType?: BreakType;
  timestamp: string;
}

export interface DriverStatusUpdatedPayload extends DriverStatusPayload {
  driverId: string;
  driverName?: string;
}

// ============================================================================
// Delivery Assignment Events
// ============================================================================

export interface DeliveryAssignmentPayload {
  deliveryId: string;
  driverId: string;
  cateringRequestId?: string;
  onDemandId?: string;
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  estimatedArrival?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

export interface DeliveryAssignedPayload extends DeliveryAssignmentPayload {
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
}

// ============================================================================
// Admin Message Events
// ============================================================================

export interface AdminMessagePayload {
  message: string;
  targetDriverId?: string; // If undefined, broadcast to all drivers
  priority?: 'info' | 'warning' | 'urgent';
  actionRequired?: boolean;
}

export interface AdminMessageReceivedPayload extends AdminMessagePayload {
  adminId: string;
  adminName: string;
  sentAt: string;
  messageId: string;
}

// ============================================================================
// Heartbeat Events
// ============================================================================

export interface HeartbeatPayload {
  timestamp: string;
}

// ============================================================================
// Presence Events
// ============================================================================

export interface PresenceState {
  userId: string;
  userType: 'DRIVER' | 'ADMIN' | 'SUPER_ADMIN' | 'HELPDESK';
  userName?: string;
  driverId?: string;
  vehicleNumber?: string;
  onlineAt: string;
}

export interface PresencePayload {
  [userId: string]: PresenceState[];
}

// ============================================================================
// Channel Configuration
// ============================================================================

export interface RealtimeChannelConfig {
  channel: RealtimeChannelName;
  options?: {
    config?: {
      broadcast?: {
        self?: boolean;
        ack?: boolean;
      };
      presence?: {
        key?: string;
      };
    };
  };
}

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface RealtimeConnectionState {
  state: ConnectionState;
  channel?: RealtimeChannel;
  error?: Error;
  connectedAt?: Date;
  reconnectAttempts: number;
  lastReconnectAt?: Date;
}

// ============================================================================
// Event Handlers
// ============================================================================

export type RealtimeEventHandler<T = any> = (payload: T) => void | Promise<void>;

export interface RealtimeEventHandlers {
  [REALTIME_EVENTS.DRIVER_LOCATION_UPDATE]?: RealtimeEventHandler<DriverLocationPayload>;
  [REALTIME_EVENTS.DRIVER_LOCATION_UPDATED]?: RealtimeEventHandler<DriverLocationUpdatedPayload>;
  [REALTIME_EVENTS.DRIVER_STATUS_UPDATE]?: RealtimeEventHandler<DriverStatusPayload>;
  [REALTIME_EVENTS.DRIVER_STATUS_UPDATED]?: RealtimeEventHandler<DriverStatusUpdatedPayload>;
  [REALTIME_EVENTS.ADMIN_ASSIGN_DELIVERY]?: RealtimeEventHandler<DeliveryAssignmentPayload>;
  [REALTIME_EVENTS.DELIVERY_ASSIGNED]?: RealtimeEventHandler<DeliveryAssignedPayload>;
  [REALTIME_EVENTS.ADMIN_MESSAGE]?: RealtimeEventHandler<AdminMessagePayload>;
  [REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED]?: RealtimeEventHandler<AdminMessageReceivedPayload>;
  [REALTIME_EVENTS.PING]?: RealtimeEventHandler<HeartbeatPayload>;
  [REALTIME_EVENTS.PONG]?: RealtimeEventHandler<HeartbeatPayload>;
}

// ============================================================================
// Error Types
// ============================================================================

export class RealtimeError extends Error {
  constructor(
    message: string,
    public code?: string,
    public channel?: string,
  ) {
    super(message);
    this.name = 'RealtimeError';
  }
}

export class RealtimeConnectionError extends RealtimeError {
  constructor(message: string, channel?: string) {
    super(message, 'CONNECTION_ERROR', channel);
    this.name = 'RealtimeConnectionError';
  }
}

export class RealtimeAuthenticationError extends RealtimeError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'RealtimeAuthenticationError';
  }
}

export class RealtimeBroadcastError extends RealtimeError {
  constructor(message: string, channel?: string) {
    super(message, 'BROADCAST_ERROR', channel);
    this.name = 'RealtimeBroadcastError';
  }
}
