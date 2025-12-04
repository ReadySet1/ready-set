/**
 * ezCater GraphQL Mutation Definitions
 *
 * GraphQL mutation strings for ezCater Delivery API.
 * These mutations manage courier assignments and delivery lifecycle events.
 *
 * @see https://api.ezcater.io/delivery-api
 */

/**
 * Assign a courier to a delivery.
 *
 * If a courier was previously assigned, they will be automatically unassigned.
 * The courier object can include optional details like name, phone, and vehicle info.
 */
export const COURIER_ASSIGN_MUTATION = `
  mutation CourierAssign($input: CourierAssignInput!) {
    courierAssign(input: $input) {
      clientMutationId
      delivery {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Unassign the current courier from a delivery.
 *
 * This removes the courier assignment without providing a replacement.
 */
export const COURIER_UNASSIGN_MUTATION = `
  mutation CourierUnassign($input: CourierUnassignInput!) {
    courierUnassign(input: $input) {
      clientMutationId
      delivery {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Report a delivery lifecycle event.
 *
 * Valid event types:
 * - COURIER_ASSIGNED: Courier has been assigned
 * - EN_ROUTE_TO_PICKUP: Courier is heading to pickup location
 * - ARRIVED_AT_PICKUP: Courier has arrived at pickup location
 * - ORDER_PICKED_UP: Order has been picked up
 * - EN_ROUTE_TO_DROPOFF: Courier is heading to delivery location
 * - ARRIVED_AT_DROPOFF: Courier has arrived at delivery location
 * - ORDER_DELIVERED: Order has been delivered
 */
export const COURIER_EVENT_CREATE_MUTATION = `
  mutation CourierEventCreate($input: CourierEventCreateInput!) {
    courierEventCreate(input: $input) {
      clientMutationId
      delivery {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Send real-time GPS tracking coordinates for a courier.
 *
 * Recommended frequency: every 20 seconds during active delivery.
 * Coordinates should be the courier's current location.
 */
export const COURIER_TRACKING_EVENT_CREATE_MUTATION = `
  mutation CourierTrackingEventCreate($input: CourierTrackingEventCreateInput!) {
    courierTrackingEventCreate(input: $input) {
      clientMutationId
      delivery {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Upload proof of delivery photos.
 *
 * Images should be provided as base64-encoded data URLs or public URLs.
 */
export const COURIER_IMAGES_CREATE_MUTATION = `
  mutation CourierImagesCreate($input: CourierImagesCreateInput!) {
    courierImagesCreate(input: $input) {
      clientMutationId
      delivery {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Bulk assign couriers to multiple deliveries at once.
 *
 * Useful for batch operations when assigning the same courier
 * to multiple deliveries or different couriers to different deliveries.
 */
export const COURIERS_ASSIGN_MUTATION = `
  mutation CouriersAssign($input: CouriersAssignInput!) {
    couriersAssign(input: $input) {
      clientMutationId
      deliveries {
        id
      }
      userErrors {
        message
        path
      }
    }
  }
`;
