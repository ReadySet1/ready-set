/**
 * ezCater API Type Definitions
 *
 * Types for ezCater Delivery API configuration and integration.
 * See: https://api.ezcater.io/delivery-api
 */

/**
 * Configuration for ezCater API connection.
 */
export interface EzCaterConfig {
  /** GraphQL API endpoint URL */
  apiUrl: string;
  /** API authentication token (server-side only) */
  apiToken: string | undefined;
  /** Client identifier for API tracking (e.g., 'ready-set') */
  clientName: string;
  /** Software version for API tracking (e.g., '1.0.0') */
  clientVersion: string;
  /** Secret for validating inbound webhook signatures */
  webhookSecret: string | undefined;
}

/**
 * Result of config validation check.
 */
export interface EzCaterConfigValidation {
  /** Whether all required config values are present */
  isValid: boolean;
  /** List of missing required environment variable names */
  missingVars: string[];
}

/**
 * Required HTTP headers for ezCater API requests.
 */
export interface EzCaterApiHeaders {
  'Content-Type': 'application/json';
  Authorization: string;
  'apollographql-client-name': string;
  'apollographql-client-version': string;
}

// ============================================================================
// Courier Types
// ============================================================================

/**
 * Vehicle information for a courier.
 * All fields are optional as not all delivery services track vehicle details.
 */
export interface EzCaterVehicle {
  /** Vehicle manufacturer (e.g., 'Toyota') */
  make?: string;
  /** Vehicle model (e.g., 'Camry') */
  model?: string;
  /** Vehicle color (e.g., 'Silver') */
  color?: string;
}

/**
 * Courier/driver information for ezCater deliveries.
 * The `id` field is required; other fields are optional but recommended.
 */
export interface EzCaterCourier {
  /** Unique identifier for the courier (required) */
  id: string;
  /** Courier's first name */
  firstName?: string;
  /** Courier's last name */
  lastName?: string;
  /** Courier's phone number (must be valid US format for ezCater) */
  phone?: string;
  /** Vehicle information */
  vehicle?: EzCaterVehicle;
}

/**
 * GPS coordinates for tracking events.
 */
export interface EzCaterCoordinates {
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
}

// ============================================================================
// Courier Event Types
// ============================================================================

/**
 * Courier lifecycle event types for the courierEventCreate mutation.
 * These represent key milestones in the delivery process.
 */
export type EzCaterCourierEventType =
  | 'COURIER_ASSIGNED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'ORDER_PICKED_UP'
  | 'EN_ROUTE_TO_DROPOFF'
  | 'ARRIVED_AT_DROPOFF'
  | 'ORDER_DELIVERED';

// ============================================================================
// Mutation Input Types
// ============================================================================

/**
 * Input for the courierAssign mutation.
 * Assigns a courier to fulfill an ezCater delivery.
 * If a courier was previously assigned, they will be automatically unassigned.
 */
export interface EzCaterCourierAssignInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** The ezCater delivery identifier (required) */
  deliveryId: string;
  /** Name of the delivery service provider (e.g., 'Ready Set', 'DoorDash') */
  deliveryServiceProvider?: string;
  /** Courier information (required) */
  courier: EzCaterCourier;
}

/**
 * Input for the courierEventCreate mutation.
 * Reports delivery lifecycle events to ezCater.
 */
export interface EzCaterCourierEventCreateInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** The ezCater delivery identifier (required) */
  deliveryId: string;
  /** Type of courier event being reported (required) */
  eventType: EzCaterCourierEventType;
  /** When the event occurred in ISO 8601 format (required) */
  occurredAt: string;
  /** GPS coordinates where the event occurred */
  coordinates?: EzCaterCoordinates;
  /** Courier information (required) */
  courier: EzCaterCourier;
}

/**
 * Input for the courierTrackingEventCreate mutation.
 * Sends real-time GPS coordinates for courier tracking.
 * Recommended frequency: every 20 seconds during active delivery.
 */
export interface EzCaterCourierTrackingEventCreateInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** The ezCater delivery identifier (required) */
  deliveryId: string;
  /** When the tracking event occurred in ISO 8601 format (required) */
  occurredAt: string;
  /** GPS coordinates (required) */
  coordinates: EzCaterCoordinates;
  /** Courier information (required) */
  courier: EzCaterCourier;
}

/**
 * Input for the courierImagesCreate mutation.
 * Uploads proof of delivery photos.
 */
export interface EzCaterCourierImagesCreateInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** The ezCater delivery identifier (required) */
  deliveryId: string;
  /** Array of publicly accessible image URLs (required, non-empty) */
  imageUrls: string[];
  /** Courier information (required) */
  courier: EzCaterCourier;
}

/**
 * Input for the courierUnassign mutation.
 * Removes the current courier assignment from a delivery.
 */
export interface EzCaterCourierUnassignInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** The ezCater delivery identifier (required) */
  deliveryId: string;
}

/**
 * Input for the couriersAssign mutation (bulk assignment).
 * Assigns couriers to multiple deliveries at once.
 */
export interface EzCaterCouriersAssignInput {
  /** Client-generated ID for tracking the mutation request */
  clientMutationId?: string;
  /** Array of individual courier assignments */
  assignments: Array<{
    deliveryId: string;
    courier: EzCaterCourier;
    deliveryServiceProvider?: string;
  }>;
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

/**
 * User error returned by ezCater API mutations.
 * These are business logic errors (not GraphQL errors).
 */
export interface EzCaterUserError {
  /** Human-readable error message */
  message: string;
  /** Path to the field that caused the error */
  path?: string[];
}

/**
 * Delivery reference returned in mutation responses.
 */
export interface EzCaterDeliveryRef {
  /** The ezCater delivery ID */
  id: string;
}

/**
 * Standard mutation response structure for ezCater API.
 */
export interface EzCaterMutationResponse {
  /** Echo of the clientMutationId from the input */
  clientMutationId?: string;
  /** Reference to the affected delivery */
  delivery?: EzCaterDeliveryRef;
  /** Array of business logic errors (empty on success) */
  userErrors: EzCaterUserError[];
}

/**
 * Generic GraphQL response wrapper.
 * Use this to type the full API response including potential GraphQL errors.
 */
export interface EzCaterGraphQLResponse<T> {
  /** The mutation/query result data */
  data?: T;
  /** GraphQL-level errors (schema violations, auth errors, etc.) */
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: Record<string, unknown>;
  }>;
}

/**
 * Typed response for courierAssign mutation.
 */
export interface EzCaterCourierAssignResponse {
  courierAssign: EzCaterMutationResponse;
}

/**
 * Typed response for courierEventCreate mutation.
 */
export interface EzCaterCourierEventCreateResponse {
  courierEventCreate: EzCaterMutationResponse;
}

/**
 * Typed response for courierTrackingEventCreate mutation.
 */
export interface EzCaterCourierTrackingEventCreateResponse {
  courierTrackingEventCreate: EzCaterMutationResponse;
}

/**
 * Typed response for courierImagesCreate mutation.
 */
export interface EzCaterCourierImagesCreateResponse {
  courierImagesCreate: EzCaterMutationResponse;
}

/**
 * Typed response for courierUnassign mutation.
 */
export interface EzCaterCourierUnassignResponse {
  courierUnassign: EzCaterMutationResponse;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook event types that ezCater can send to our endpoint.
 */
export type EzCaterWebhookEventType =
  | 'order.placed'
  | 'order.accepted'
  | 'order.rejected'
  | 'order.canceled'
  | 'order.updated';

/**
 * Webhook payload structure from ezCater.
 */
export interface EzCaterWebhookPayload {
  /** Type of event that triggered the webhook */
  eventType: EzCaterWebhookEventType;
  /** ID of the entity (order ID) */
  entityId: string;
  /** Type of entity */
  entityType: 'order';
  /** When the event occurred in ISO 8601 format */
  timestamp: string;
  /** Additional event-specific data */
  data?: Record<string, unknown>;
}

// ============================================================================
// Order Types
// ============================================================================

/**
 * ezCater order status values.
 */
export type EzCaterOrderStatus = 'placed' | 'accepted' | 'rejected' | 'canceled';

/**
 * Address structure used by ezCater.
 */
export interface EzCaterAddress {
  /** Street address line 1 */
  street1: string;
  /** Street address line 2 (apt, suite, etc.) */
  street2?: string;
  /** City name */
  city: string;
  /** State/province code */
  state: string;
  /** Postal/ZIP code */
  zip: string;
  /** Country code (defaults to US if not specified) */
  country?: string;
}

/**
 * Customer information from ezCater order.
 */
export interface EzCaterCustomer {
  /** Customer's full name */
  name: string;
  /** Customer's phone number */
  phone?: string;
  /** Customer's email address */
  email?: string;
}

/**
 * ezCater order details returned from order queries.
 */
export interface EzCaterOrder {
  /** ezCater's internal order ID */
  id: string;
  /** Order UUID */
  uuid: string;
  /** Delivery ID required for courier mutations */
  deliveryId: string;
  /** Current order status */
  status: EzCaterOrderStatus;
  /** Customer information */
  customer: EzCaterCustomer;
  /** Delivery destination address */
  deliveryAddress: EzCaterAddress;
  /** Requested delivery/fulfillment time in ISO 8601 format */
  fulfillmentTime: string;
  /** ID of the store/restaurant fulfilling the order */
  storeId: string;
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Maps Ready Set delivery statuses to ezCater courier event types.
 * Use this when reporting status changes to ezCater.
 */
export const READY_SET_TO_EZCATER_EVENT_MAP: Record<
  string,
  EzCaterCourierEventType
> = {
  assigned: 'COURIER_ASSIGNED',
  en_route_to_pickup: 'EN_ROUTE_TO_PICKUP',
  arrived_at_pickup: 'ARRIVED_AT_PICKUP',
  picked_up: 'ORDER_PICKED_UP',
  in_transit: 'EN_ROUTE_TO_DROPOFF',
  arrived_at_delivery: 'ARRIVED_AT_DROPOFF',
  delivered: 'ORDER_DELIVERED',
} as const;

/**
 * Type for valid Ready Set statuses that map to ezCater events.
 */
export type ReadySetMappableStatus = keyof typeof READY_SET_TO_EZCATER_EVENT_MAP;
