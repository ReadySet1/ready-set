/**
 * Zod Schemas for Realtime Payloads
 *
 * Provides comprehensive validation for all realtime event payloads
 * with size limits, input sanitization, and detailed error messages.
 */

import { z } from 'zod';
import { InputSanitizer } from '@/lib/validation';
import { REALTIME_EVENTS } from './types';
import { PAYLOAD_CONFIG } from '@/constants/realtime-config';

// ============================================================================
// Configuration
// ============================================================================

// Re-export MAX_PAYLOAD_SIZE for backward compatibility
export const MAX_PAYLOAD_SIZE = PAYLOAD_CONFIG.MAX_PAYLOAD_SIZE;

// ============================================================================
// Base Schemas
// ============================================================================

/**
 * Coordinate validation schema
 * Latitude: -90 to 90, Longitude: -180 to 180
 */
const CoordinateSchema = z.object({
  lat: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

/**
 * Location with address schema
 */
const LocationSchema = CoordinateSchema.extend({
  address: z
    .string()
    .min(1, 'Address is required')
    .max(PAYLOAD_CONFIG.MAX_ADDRESS_LENGTH, `Address must not exceed ${PAYLOAD_CONFIG.MAX_ADDRESS_LENGTH} characters`)
    .transform((val) => InputSanitizer.sanitizeText(val)),
});

/**
 * ISO 8601 timestamp schema
 */
const TimestampSchema = z
  .string()
  .datetime({ message: 'Must be a valid ISO 8601 datetime' });

/**
 * UUID schema
 */
const UUIDSchema = z
  .string()
  .uuid({ message: 'Must be a valid UUID' })
  .max(PAYLOAD_CONFIG.MAX_ID_LENGTH);

/**
 * Sanitized string schema
 */
const SanitizedStringSchema = (maxLength: number = PAYLOAD_CONFIG.MAX_STRING_LENGTH) =>
  z
    .string()
    .min(1, 'String cannot be empty')
    .max(maxLength, `String must not exceed ${maxLength} characters`)
    .transform((val) => InputSanitizer.sanitizeText(val));

// ============================================================================
// Driver Location Schemas
// ============================================================================

export const DriverLocationPayloadSchema = z.object({
  lat: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  lng: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  accuracy: z
    .number()
    .min(0, 'Accuracy must be non-negative')
    .max(1000, 'Accuracy seems unrealistic (max 1000m)'),
  speed: z
    .number()
    .min(0, 'Speed must be non-negative')
    .max(500, 'Speed seems unrealistic (max 500 km/h)')
    .nullable()
    .optional(),
  heading: z
    .number()
    .min(0, 'Heading must be between 0 and 360')
    .max(360, 'Heading must be between 0 and 360')
    .nullable()
    .optional(),
  altitude: z
    .number()
    .min(-500, 'Altitude must be reasonable')
    .max(10000, 'Altitude must be reasonable')
    .nullable()
    .optional(),
  batteryLevel: z
    .number()
    .min(0, 'Battery level must be between 0 and 100')
    .max(100, 'Battery level must be between 0 and 100')
    .nullable()
    .optional(),
  isMoving: z.boolean().optional(),
  activityType: z
    .enum(['walking', 'driving', 'stationary'])
    .nullable()
    .optional(),
  timestamp: TimestampSchema,
});

export const DriverLocationUpdatedPayloadSchema = DriverLocationPayloadSchema.extend({
  driverId: UUIDSchema,
  driverName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
  vehicleNumber: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
});

// ============================================================================
// Driver Status Schemas
// ============================================================================

export const DriverStatusSchema = z.enum(['active', 'on_break', 'off_duty', 'unavailable']);
export const BreakTypeSchema = z.enum(['rest', 'meal', 'fuel', 'emergency']);

export const DriverStatusPayloadSchema = z.object({
  status: DriverStatusSchema,
  shiftId: UUIDSchema.optional(),
  breakType: BreakTypeSchema.optional(),
  timestamp: TimestampSchema,
});

export const DriverStatusUpdatedPayloadSchema = DriverStatusPayloadSchema.extend({
  driverId: UUIDSchema,
  driverName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
});

// ============================================================================
// Delivery Assignment Schemas
// ============================================================================

const DeliveryPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const DeliveryAssignmentPayloadSchema = z.object({
  deliveryId: UUIDSchema,
  driverId: UUIDSchema,
  cateringRequestId: UUIDSchema.optional(),
  onDemandId: UUIDSchema.optional(),
  pickupLocation: LocationSchema,
  deliveryLocation: LocationSchema,
  estimatedArrival: TimestampSchema.optional(),
  priority: DeliveryPrioritySchema.optional(),
  notes: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_MESSAGE_LENGTH).optional(),
});

export const DeliveryAssignedPayloadSchema = DeliveryAssignmentPayloadSchema.extend({
  assignedBy: UUIDSchema,
  assignedByName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH),
  assignedAt: TimestampSchema,
});

// ============================================================================
// Delivery Status Schemas (for order tracking)
// ============================================================================

export const DeliveryTrackingStatusSchema = z.enum([
  'ASSIGNED',
  'ARRIVED_AT_VENDOR',
  'PICKED_UP',
  'EN_ROUTE_TO_CLIENT',
  'ARRIVED_TO_CLIENT',
  'COMPLETED',
]);

export const OrderTypeSchema = z.enum(['catering', 'on_demand']);

export const DeliveryStatusPayloadSchema = z.object({
  deliveryId: UUIDSchema.optional(),
  orderId: UUIDSchema,
  orderNumber: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH),
  orderType: OrderTypeSchema,
  driverId: UUIDSchema,
  status: DeliveryTrackingStatusSchema,
  previousStatus: DeliveryTrackingStatusSchema.optional(),
  timestamp: TimestampSchema,
});

export const DeliveryStatusUpdatedPayloadSchema = DeliveryStatusPayloadSchema.extend({
  driverName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
  estimatedArrival: TimestampSchema.optional(),
});

// ============================================================================
// Admin Message Schemas
// ============================================================================

const MessagePrioritySchema = z.enum(['info', 'warning', 'urgent']);

export const AdminMessagePayloadSchema = z.object({
  message: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_MESSAGE_LENGTH),
  targetDriverId: UUIDSchema.optional(),
  priority: MessagePrioritySchema.optional(),
  actionRequired: z.boolean().optional(),
});

export const AdminMessageReceivedPayloadSchema = AdminMessagePayloadSchema.extend({
  adminId: UUIDSchema,
  adminName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH),
  sentAt: TimestampSchema,
  messageId: UUIDSchema,
});

// ============================================================================
// Heartbeat Schemas
// ============================================================================

export const HeartbeatPayloadSchema = z.object({
  timestamp: TimestampSchema,
});

// ============================================================================
// Presence Schemas
// ============================================================================

const UserTypeSchema = z.enum(['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'HELPDESK']);

export const PresenceStateSchema = z.object({
  userId: UUIDSchema,
  userType: UserTypeSchema,
  userName: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
  driverId: UUIDSchema.optional(),
  vehicleNumber: SanitizedStringSchema(PAYLOAD_CONFIG.MAX_STRING_LENGTH).optional(),
  onlineAt: TimestampSchema,
});

export const PresencePayloadSchema = z.record(z.string(), z.array(PresenceStateSchema));

// ============================================================================
// Event-to-Schema Mapping
// ============================================================================

export const PAYLOAD_SCHEMAS = {
  [REALTIME_EVENTS.DRIVER_LOCATION_UPDATE]: DriverLocationPayloadSchema,
  [REALTIME_EVENTS.DRIVER_LOCATION_UPDATED]: DriverLocationUpdatedPayloadSchema,
  [REALTIME_EVENTS.DRIVER_STATUS_UPDATE]: DriverStatusPayloadSchema,
  [REALTIME_EVENTS.DRIVER_STATUS_UPDATED]: DriverStatusUpdatedPayloadSchema,
  [REALTIME_EVENTS.ADMIN_ASSIGN_DELIVERY]: DeliveryAssignmentPayloadSchema,
  [REALTIME_EVENTS.DELIVERY_ASSIGNED]: DeliveryAssignedPayloadSchema,
  [REALTIME_EVENTS.ADMIN_MESSAGE]: AdminMessagePayloadSchema,
  [REALTIME_EVENTS.ADMIN_MESSAGE_RECEIVED]: AdminMessageReceivedPayloadSchema,
  [REALTIME_EVENTS.DELIVERY_STATUS_UPDATE]: DeliveryStatusPayloadSchema,
  [REALTIME_EVENTS.DELIVERY_STATUS_UPDATED]: DeliveryStatusUpdatedPayloadSchema,
  [REALTIME_EVENTS.PING]: HeartbeatPayloadSchema,
  [REALTIME_EVENTS.PONG]: HeartbeatPayloadSchema,
} as const;

// ============================================================================
// Validation Functions
// ============================================================================

export class PayloadValidationError extends Error {
  constructor(
    message: string,
    public eventName: string,
    public errors: z.ZodError,
  ) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

export class PayloadSizeError extends Error {
  constructor(
    message: string,
    public eventName: string,
    public size: number,
    public maxSize: number,
  ) {
    super(message);
    this.name = 'PayloadSizeError';
  }
}

/**
 * Validate payload size to prevent DoS attacks
 */
export function validatePayloadSize(payload: unknown, eventName: string): void {
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    throw new PayloadSizeError(
      `Payload for ${eventName} exceeds maximum size of ${MAX_PAYLOAD_SIZE} bytes (actual: ${payloadSize} bytes)`,
      eventName,
      payloadSize,
      MAX_PAYLOAD_SIZE,
    );
  }
}

/**
 * Validate payload against event schema
 */
export function validatePayload<T>(eventName: string, payload: unknown): T {
  // First check payload size
  validatePayloadSize(payload, eventName);

  // Get schema for event
  const schema = PAYLOAD_SCHEMAS[eventName as keyof typeof PAYLOAD_SCHEMAS];

  // If no schema defined, allow any payload (backwards compatibility)
  if (!schema) {
    return payload as T;
  }

  // Validate with Zod
  const result = schema.safeParse(payload);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');

    throw new PayloadValidationError(
      `Invalid payload for ${eventName}: ${errorMessages}`,
      eventName,
      result.error,
    );
  }

  return result.data as T;
}

/**
 * Create a validation function for a specific event type
 */
export function createValidator<T>(eventName: string) {
  return (payload: unknown): T => validatePayload<T>(eventName, payload);
}

// ============================================================================
// Type Exports
// ============================================================================

// Export inferred types from schemas
export type DriverLocationPayload = z.infer<typeof DriverLocationPayloadSchema>;
export type DriverLocationUpdatedPayload = z.infer<typeof DriverLocationUpdatedPayloadSchema>;
export type DriverStatusPayload = z.infer<typeof DriverStatusPayloadSchema>;
export type DriverStatusUpdatedPayload = z.infer<typeof DriverStatusUpdatedPayloadSchema>;
export type DeliveryAssignmentPayload = z.infer<typeof DeliveryAssignmentPayloadSchema>;
export type DeliveryAssignedPayload = z.infer<typeof DeliveryAssignedPayloadSchema>;
export type AdminMessagePayload = z.infer<typeof AdminMessagePayloadSchema>;
export type AdminMessageReceivedPayload = z.infer<typeof AdminMessageReceivedPayloadSchema>;
export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;
export type PresenceState = z.infer<typeof PresenceStateSchema>;
export type PresencePayload = z.infer<typeof PresencePayloadSchema>;
export type DeliveryTrackingStatus = z.infer<typeof DeliveryTrackingStatusSchema>;
export type DeliveryStatusPayload = z.infer<typeof DeliveryStatusPayloadSchema>;
export type DeliveryStatusUpdatedPayload = z.infer<typeof DeliveryStatusUpdatedPayloadSchema>;
