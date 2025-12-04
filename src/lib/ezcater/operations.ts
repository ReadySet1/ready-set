/**
 * ezCater Typed Operations
 *
 * Type-safe functions for each ezCater mutation.
 * Each function handles request execution and response validation.
 */

import { executeQuery, checkMutationResponse } from './client';
import {
  COURIER_ASSIGN_MUTATION,
  COURIER_UNASSIGN_MUTATION,
  COURIER_EVENT_CREATE_MUTATION,
  COURIER_TRACKING_EVENT_CREATE_MUTATION,
  COURIER_IMAGES_CREATE_MUTATION,
  COURIERS_ASSIGN_MUTATION,
} from './mutations';
import type {
  EzCaterCourierAssignInput,
  EzCaterCourierUnassignInput,
  EzCaterCourierEventCreateInput,
  EzCaterCourierTrackingEventCreateInput,
  EzCaterCourierImagesCreateInput,
  EzCaterCouriersAssignInput,
  EzCaterCourierAssignResponse,
  EzCaterCourierUnassignResponse,
  EzCaterCourierEventCreateResponse,
  EzCaterCourierTrackingEventCreateResponse,
  EzCaterCourierImagesCreateResponse,
  EzCaterMutationResponse,
} from '@/types/ezcater';

/**
 * Assign a courier to an ezCater delivery.
 *
 * If a courier was previously assigned, they will be automatically unassigned.
 *
 * @example
 * ```typescript
 * await courierAssign({
 *   deliveryId: 'delivery-123',
 *   courier: {
 *     id: 'driver-456',
 *     firstName: 'John',
 *     lastName: 'Doe',
 *     phone: '+1234567890',
 *   },
 * });
 * ```
 */
export async function courierAssign(
  input: EzCaterCourierAssignInput
): Promise<EzCaterMutationResponse> {
  const response = await executeQuery<EzCaterCourierAssignResponse>(
    COURIER_ASSIGN_MUTATION,
    { input },
    { operationName: 'courierAssign' }
  );

  checkMutationResponse(response.courierAssign, {
    operation: 'courierAssign',
    deliveryId: input.deliveryId,
  });

  return response.courierAssign;
}

/**
 * Unassign the current courier from an ezCater delivery.
 *
 * @example
 * ```typescript
 * await courierUnassign({
 *   deliveryId: 'delivery-123',
 * });
 * ```
 */
export async function courierUnassign(
  input: EzCaterCourierUnassignInput
): Promise<EzCaterMutationResponse> {
  const response = await executeQuery<EzCaterCourierUnassignResponse>(
    COURIER_UNASSIGN_MUTATION,
    { input },
    { operationName: 'courierUnassign' }
  );

  checkMutationResponse(response.courierUnassign, {
    operation: 'courierUnassign',
    deliveryId: input.deliveryId,
  });

  return response.courierUnassign;
}

/**
 * Report a delivery lifecycle event to ezCater.
 *
 * Events track the delivery progress from assignment to completion.
 *
 * @example
 * ```typescript
 * await courierEventCreate({
 *   deliveryId: 'delivery-123',
 *   eventType: 'ORDER_PICKED_UP',
 *   occurredAt: new Date().toISOString(),
 *   courier: { id: 'driver-456' },
 * });
 * ```
 *
 * Event types:
 * - COURIER_ASSIGNED
 * - EN_ROUTE_TO_PICKUP
 * - ARRIVED_AT_PICKUP
 * - ORDER_PICKED_UP
 * - EN_ROUTE_TO_DROPOFF
 * - ARRIVED_AT_DROPOFF
 * - ORDER_DELIVERED
 */
export async function courierEventCreate(
  input: EzCaterCourierEventCreateInput
): Promise<EzCaterMutationResponse> {
  const response = await executeQuery<EzCaterCourierEventCreateResponse>(
    COURIER_EVENT_CREATE_MUTATION,
    { input },
    { operationName: 'courierEventCreate' }
  );

  checkMutationResponse(response.courierEventCreate, {
    operation: 'courierEventCreate',
    deliveryId: input.deliveryId,
  });

  return response.courierEventCreate;
}

/**
 * Send real-time GPS tracking coordinates for a courier.
 *
 * Recommended frequency: every 20 seconds during active delivery.
 *
 * @example
 * ```typescript
 * await courierTrackingEventCreate({
 *   deliveryId: 'delivery-123',
 *   courier: { id: 'driver-456' },
 *   coordinates: {
 *     latitude: 37.7749,
 *     longitude: -122.4194,
 *   },
 *   occurredAt: new Date().toISOString(),
 * });
 * ```
 */
export async function courierTrackingEventCreate(
  input: EzCaterCourierTrackingEventCreateInput
): Promise<EzCaterMutationResponse> {
  const response = await executeQuery<EzCaterCourierTrackingEventCreateResponse>(
    COURIER_TRACKING_EVENT_CREATE_MUTATION,
    { input },
    { operationName: 'courierTrackingEventCreate' }
  );

  checkMutationResponse(response.courierTrackingEventCreate, {
    operation: 'courierTrackingEventCreate',
    deliveryId: input.deliveryId,
  });

  return response.courierTrackingEventCreate;
}

/**
 * Upload proof of delivery photos.
 *
 * @example
 * ```typescript
 * await courierImagesCreate({
 *   deliveryId: 'delivery-123',
 *   images: [
 *     { url: 'https://example.com/photo1.jpg' },
 *     { url: 'https://example.com/photo2.jpg' },
 *   ],
 * });
 * ```
 */
export async function courierImagesCreate(
  input: EzCaterCourierImagesCreateInput
): Promise<EzCaterMutationResponse> {
  const response = await executeQuery<EzCaterCourierImagesCreateResponse>(
    COURIER_IMAGES_CREATE_MUTATION,
    { input },
    { operationName: 'courierImagesCreate' }
  );

  checkMutationResponse(response.courierImagesCreate, {
    operation: 'courierImagesCreate',
    deliveryId: input.deliveryId,
  });

  return response.courierImagesCreate;
}

/**
 * Response type for bulk courier assignment.
 */
export interface CouriersAssignResponse {
  clientMutationId?: string;
  deliveries?: { id: string }[];
  userErrors: Array<{ message: string; path?: string[] }>;
}

/**
 * Bulk assign couriers to multiple deliveries at once.
 *
 * @example
 * ```typescript
 * await couriersAssign({
 *   assignments: [
 *     { deliveryId: 'delivery-1', courier: { id: 'driver-1' } },
 *     { deliveryId: 'delivery-2', courier: { id: 'driver-2' } },
 *   ],
 * });
 * ```
 */
export async function couriersAssign(
  input: EzCaterCouriersAssignInput
): Promise<CouriersAssignResponse> {
  const response = await executeQuery<{ couriersAssign: CouriersAssignResponse }>(
    COURIERS_ASSIGN_MUTATION,
    { input },
    { operationName: 'couriersAssign' }
  );

  checkMutationResponse(response.couriersAssign as EzCaterMutationResponse, {
    operation: 'couriersAssign',
  });

  return response.couriersAssign;
}
