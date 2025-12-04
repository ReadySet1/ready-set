/**
 * ezCater GraphQL Client Module
 *
 * Provides a type-safe GraphQL client for ezCater Delivery API integration.
 *
 * @module @/lib/ezcater
 *
 * @example
 * ```typescript
 * import { courierAssign, courierEventCreate } from '@/lib/ezcater';
 *
 * // Assign a courier
 * await courierAssign({
 *   deliveryId: 'delivery-123',
 *   courier: { id: 'driver-456', firstName: 'John', lastName: 'Doe' },
 * });
 *
 * // Report delivery event
 * await courierEventCreate({
 *   deliveryId: 'delivery-123',
 *   eventType: 'ORDER_PICKED_UP',
 *   occurredAt: new Date().toISOString(),
 *   courier: { id: 'driver-456' },
 * });
 * ```
 */

// High-level typed operations (recommended)
export {
  courierAssign,
  courierUnassign,
  courierEventCreate,
  courierTrackingEventCreate,
  courierImagesCreate,
  couriersAssign,
  type CouriersAssignResponse,
} from './operations';

// Low-level client (for custom queries)
export {
  executeQuery,
  checkMutationResponse,
  resetClient,
  type ExecuteQueryOptions,
} from './client';

// Error handling
export {
  EzCaterApiError,
  isEzCaterRetryableError,
  type EzCaterErrorContext,
} from './errors';

// Resilience/monitoring
export {
  ezCaterCircuitBreaker,
  getEzCaterCircuitBreakerStatus,
  resetEzCaterCircuitBreaker,
  withEzCaterResilience,
  EZCATER_RESILIENCE_CONFIG,
} from './resilience';

// Mutations (for direct usage if needed)
export {
  COURIER_ASSIGN_MUTATION,
  COURIER_UNASSIGN_MUTATION,
  COURIER_EVENT_CREATE_MUTATION,
  COURIER_TRACKING_EVENT_CREATE_MUTATION,
  COURIER_IMAGES_CREATE_MUTATION,
  COURIERS_ASSIGN_MUTATION,
} from './mutations';
