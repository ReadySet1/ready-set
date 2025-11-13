// types/catervalley.ts
// TypeScript type definitions for CaterValley API integration

/**
 * Request Headers Required for All CaterValley Requests
 */
export interface CaterValleyHeaders {
  "Content-Type": "application/json";
  partner: "catervalley";
  "x-api-key": string;
}

/**
 * Address Information
 */
export interface Address {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
}

/**
 * Order Item
 */
export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

/**
 * Draft Order Request
 * Sent from CaterValley to create initial order and get pricing
 */
export interface DraftOrderRequest {
  orderCode: string;
  deliveryAddress: Address;
  pickupLocation: Address;
  deliveryTime: string; // Local time format (e.g., "11:00")
  priceTotal: number;
  items: OrderItem[];
  headCount?: number;
  deliveryDate?: string;
  specialInstructions?: string;
}

/**
 * Pricing Breakdown
 */
export interface PricingBreakdown {
  basePrice: number;
  peakTimeMultiplier?: number;
  distanceTier?: string;
  headCountTier?: string;
  foodCostTier?: string;
  tipIncluded?: boolean;
  calculation?: string;
  discountApplied?: number;
  deliveryCountDiscount?: {
    appliedCount: number;
    discountPercentage: number;
  };
}

/**
 * Draft Order Response
 * Returned by ReadySet with pricing information
 */
export interface DraftOrderResponse {
  id: string; // UUID from ReadySet database
  deliveryPrice: number; // Must be minimum $42.50
  totalPrice: number;
  estimatedPickupTime: string; // UTC ISO 8601 format with Z suffix
  status: "SUCCESS" | "ERROR";
  breakdown: PricingBreakdown;
  error?: string;
  warnings?: string[];
}

/**
 * Update Order Request
 * Sent from CaterValley when order is modified
 */
export interface UpdateOrderRequest {
  id: string; // UUID returned from draft endpoint
  orderCode: string;
  deliveryAddress?: Address;
  deliveryTime?: string;
  priceTotal?: number;
  items?: OrderItem[];
  headCount?: number;
  specialInstructions?: string;
}

/**
 * Update Order Response
 * Same structure as DraftOrderResponse
 */
export type UpdateOrderResponse = DraftOrderResponse;

/**
 * Confirm Order Request
 * Sent from CaterValley to finalize the order
 */
export interface ConfirmOrderRequest {
  id: string; // UUID from draft/update responses
  orderCode: string;
  paymentConfirmed?: boolean;
  customerNotes?: string;
}

/**
 * Driver Assignment Information
 */
export interface DriverAssignment {
  expectedAssignmentTime: string; // UTC ISO 8601
  trackingAvailable: boolean;
  estimatedArrivalTime?: string;
}

/**
 * Confirm Order Response
 * Returned when order is successfully confirmed
 */
export interface ConfirmOrderResponse {
  id: string;
  orderNumber: string; // CaterValley order number (e.g., "CV-ABC1234")
  status: "CONFIRMED" | "ERROR";
  message: string;
  estimatedDeliveryTime: string; // UTC ISO 8601
  driverAssignment: DriverAssignment;
  error?: string;
}

/**
 * API Status Response
 */
export interface StatusResponse {
  status: "operational" | "degraded" | "down";
  timestamp: string;
  version?: string;
  uptime?: number;
  services?: {
    database: "connected" | "disconnected";
    webhook: "operational" | "degraded";
  };
}

/**
 * Courier Status Types
 */
export type CourierStatus =
  | "ASSIGNED" // Driver has been assigned to the order
  | "PICKED_UP" // Driver has picked up the order
  | "ON_THE_WAY" // Driver is en route to delivery location
  | "ARRIVED" // Driver has arrived at delivery location
  | "DELIVERED" // Order has been delivered
  | "CANCELLED" // Order was cancelled
  | "FAILED"; // Delivery failed

/**
 * Location Coordinates
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Driver Information
 */
export interface DriverInfo {
  name: string;
  phone: string;
  vehicleInfo?: string;
  photoUrl?: string;
}

/**
 * Status Update Webhook Payload
 * Sent from ReadySet to CaterValley
 */
export interface StatusUpdateWebhook {
  orderNumber: string; // CaterValley order number
  status: CourierStatus;
  timestamp: string; // UTC ISO 8601
  location?: Location;
  notes?: string;
  driverInfo?: DriverInfo;
  estimatedArrival?: string; // UTC ISO 8601
  proofOfDelivery?: {
    signatureUrl?: string;
    photoUrl?: string;
    recipientName?: string;
  };
}

/**
 * Webhook Response
 * Expected response from CaterValley webhook
 */
export interface WebhookResponse {
  success: boolean;
  message?: string;
  timestamp: string;
}

/**
 * Error Response
 */
export interface ErrorResponse {
  error: true;
  message: string;
  code: ErrorCode;
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Error Codes
 */
export type ErrorCode =
  | "INVALID_AUTHENTICATION"
  | "ORDER_NOT_FOUND"
  | "INVALID_DELIVERY_TIME"
  | "PRICING_ERROR"
  | "MINIMUM_FEE_NOT_MET"
  | "WEBHOOK_DELIVERY_FAILED"
  | "DATABASE_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_SERVER_ERROR";

/**
 * Database Order Model
 * Internal representation of order in ReadySet system
 */
export interface CaterValleyOrder {
  id: string; // UUID
  orderCode: string; // CaterValley order code
  orderNumber?: string; // Assigned after confirmation
  status: "DRAFT" | "CONFIRMED" | "ASSIGNED" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";
  deliveryAddress: Address;
  pickupLocation: Address;
  deliveryTime: Date;
  estimatedPickupTime: Date;
  estimatedDeliveryTime?: Date;
  priceTotal: number;
  deliveryPrice: number;
  totalPrice: number;
  items: OrderItem[];
  breakdown: PricingBreakdown;
  headCount?: number;
  specialInstructions?: string;
  driverAssigned?: string;
  statusHistory: Array<{
    status: CourierStatus;
    timestamp: Date;
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
}

/**
 * Webhook Delivery Log
 * Track webhook delivery attempts
 */
export interface WebhookDeliveryLog {
  id: string;
  orderId: string;
  orderNumber: string;
  status: CourierStatus;
  webhookUrl: string;
  payload: StatusUpdateWebhook;
  response?: WebhookResponse;
  httpStatus?: number;
  attempt: number;
  maxAttempts: number;
  success: boolean;
  error?: string;
  deliveredAt?: Date;
  createdAt: Date;
}

/**
 * Pricing Configuration
 */
export interface PricingConfig {
  minimumDeliveryFee: number; // $42.50
  headCountTiers: Array<{
    min: number;
    max?: number;
    pricing: number;
    tip: number;
  }>;
  foodCostTiers: Array<{
    min: number;
    max?: number;
    pricing: number;
    tip: number;
  }>;
  peakHours: Array<{
    startTime: string;
    endTime: string;
    multiplier: number;
  }>;
  discountTiers: Array<{
    minDeliveries: number;
    discountPercentage: number;
  }>;
}
