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
  constructor(message: string, channel?: string, public eventName?: string) {
    super(message, 'BROADCAST_ERROR', channel);
    this.name = 'RealtimeBroadcastError';
  }
}

export class RealtimeValidationError extends RealtimeError {
  constructor(message: string, public eventName?: string, public validationErrors?: string[]) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'RealtimeValidationError';
  }
}

// ============================================================================
// Payload Validation
// ============================================================================

/**
 * Type guard for DriverLocationPayload
 */
function isDriverLocationPayload(payload: unknown): payload is DriverLocationPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<DriverLocationPayload>;
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    typeof p.accuracy === 'number' &&
    typeof p.timestamp === 'string'
  );
}

/**
 * Type guard for DriverLocationUpdatedPayload
 */
function isDriverLocationUpdatedPayload(payload: unknown): payload is DriverLocationUpdatedPayload {
  if (!isDriverLocationPayload(payload)) return false;
  const p = payload as Partial<DriverLocationUpdatedPayload>;
  return typeof p.driverId === 'string';
}

/**
 * Type guard for DriverStatusPayload
 */
function isDriverStatusPayload(payload: unknown): payload is DriverStatusPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<DriverStatusPayload>;
  const validStatuses: DriverStatus[] = ['active', 'on_break', 'off_duty', 'unavailable'];
  return (
    typeof p.status === 'string' &&
    validStatuses.includes(p.status as DriverStatus) &&
    typeof p.timestamp === 'string'
  );
}

/**
 * Type guard for DriverStatusUpdatedPayload
 */
function isDriverStatusUpdatedPayload(payload: unknown): payload is DriverStatusUpdatedPayload {
  if (!isDriverStatusPayload(payload)) return false;
  const p = payload as Partial<DriverStatusUpdatedPayload>;
  return typeof p.driverId === 'string';
}

/**
 * Type guard for DeliveryAssignmentPayload
 */
function isDeliveryAssignmentPayload(payload: unknown): payload is DeliveryAssignmentPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<DeliveryAssignmentPayload>;
  return (
    typeof p.deliveryId === 'string' &&
    typeof p.driverId === 'string' &&
    p.pickupLocation !== undefined &&
    typeof p.pickupLocation === 'object' &&
    typeof (p.pickupLocation as any).lat === 'number' &&
    typeof (p.pickupLocation as any).lng === 'number' &&
    p.deliveryLocation !== undefined &&
    typeof p.deliveryLocation === 'object' &&
    typeof (p.deliveryLocation as any).lat === 'number' &&
    typeof (p.deliveryLocation as any).lng === 'number'
  );
}

/**
 * Type guard for DeliveryAssignedPayload
 */
function isDeliveryAssignedPayload(payload: unknown): payload is DeliveryAssignedPayload {
  if (!isDeliveryAssignmentPayload(payload)) return false;
  const p = payload as Partial<DeliveryAssignedPayload>;
  return (
    typeof p.assignedBy === 'string' &&
    typeof p.assignedByName === 'string' &&
    typeof p.assignedAt === 'string'
  );
}

/**
 * Type guard for AdminMessagePayload
 */
function isAdminMessagePayload(payload: unknown): payload is AdminMessagePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<AdminMessagePayload>;
  return typeof p.message === 'string';
}

/**
 * Type guard for AdminMessageReceivedPayload
 */
function isAdminMessageReceivedPayload(payload: unknown): payload is AdminMessageReceivedPayload {
  if (!isAdminMessagePayload(payload)) return false;
  const p = payload as Partial<AdminMessageReceivedPayload>;
  return (
    typeof p.adminId === 'string' &&
    typeof p.adminName === 'string' &&
    typeof p.sentAt === 'string' &&
    typeof p.messageId === 'string'
  );
}

/**
 * Type guard for HeartbeatPayload
 */
function isHeartbeatPayload(payload: unknown): payload is HeartbeatPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<HeartbeatPayload>;
  return typeof p.timestamp === 'string';
}

/**
 * Validate broadcast payload matches event type
 * Returns validation result with success flag and error message
 */
export function validateBroadcastPayload(
  eventName: string,
  payload: unknown,
): { success: boolean; error?: string } {
  switch (eventName) {
    case REALTIME_EVENTS.DRIVER_LOCATION_UPDATE:
      return isDriverLocationPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DriverLocationPayload' };

    case REALTIME_EVENTS.DRIVER_LOCATION_UPDATED:
      return isDriverLocationUpdatedPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DriverLocationUpdatedPayload' };

    case REALTIME_EVENTS.DRIVER_STATUS_UPDATE:
      return isDriverStatusPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DriverStatusPayload' };

    case REALTIME_EVENTS.DRIVER_STATUS_UPDATED:
      return isDriverStatusUpdatedPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DriverStatusUpdatedPayload' };

    case REALTIME_EVENTS.ADMIN_ASSIGN_DELIVERY:
      return isDeliveryAssignmentPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DeliveryAssignmentPayload' };

    case REALTIME_EVENTS.DELIVERY_ASSIGNED:
      return isDeliveryAssignedPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid DeliveryAssignedPayload' };

    case REALTIME_EVENTS.ADMIN_MESSAGE:
      return isAdminMessagePayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid AdminMessagePayload' };

    case REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED:
      return isAdminMessageReceivedPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid AdminMessageReceivedPayload' };

    case REALTIME_EVENTS.PING:
    case REALTIME_EVENTS.PONG:
      return isHeartbeatPayload(payload)
        ? { success: true }
        : { success: false, error: 'Payload must be a valid HeartbeatPayload' };

    default:
      // For unknown events, allow any payload (backwards compatibility)
      return { success: true };
  }
}
