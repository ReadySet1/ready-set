/**
 * Delivery Status Transition Logic
 * Centralized status transition rules for driver deliveries
 */

import { DriverStatus } from '@/types/user';

/**
 * Ordered list of driver statuses representing the delivery lifecycle
 * Flow: Assigned → At Vendor → En Route → Arrived → Completed
 */
export const STATUS_ORDER: DriverStatus[] = [
  DriverStatus.ASSIGNED,
  DriverStatus.ARRIVED_AT_VENDOR,
  DriverStatus.EN_ROUTE_TO_CLIENT,
  DriverStatus.ARRIVED_TO_CLIENT,
  DriverStatus.COMPLETED,
];

/**
 * Human-readable labels for each status
 */
export const STATUS_LABELS: Record<DriverStatus, string> = {
  [DriverStatus.ASSIGNED]: 'Assigned',
  [DriverStatus.ARRIVED_AT_VENDOR]: 'At Vendor',
  [DriverStatus.PICKED_UP]: 'Picked Up',
  [DriverStatus.EN_ROUTE_TO_CLIENT]: 'En Route',
  [DriverStatus.ARRIVED_TO_CLIENT]: 'Arrived',
  [DriverStatus.COMPLETED]: 'Completed',
};

/**
 * Short action labels for the "next step" button
 * Matches the 5-step flow: Start → En Route → Arrived → Complete → Done
 */
export const NEXT_ACTION_LABELS: Record<DriverStatus, string> = {
  [DriverStatus.ASSIGNED]: 'Start',
  [DriverStatus.ARRIVED_AT_VENDOR]: 'En Route',
  [DriverStatus.PICKED_UP]: 'En Route', // Legacy - kept for backwards compatibility
  [DriverStatus.EN_ROUTE_TO_CLIENT]: 'Arrived',
  [DriverStatus.ARRIVED_TO_CLIENT]: 'Complete',
  [DriverStatus.COMPLETED]: 'Done',
};

/**
 * Get the index of a status in the status order
 */
export function getStatusIndex(status: DriverStatus | string | null | undefined): number {
  if (!status) return -1;
  const statusValue = typeof status === 'string' ? status : status;
  return STATUS_ORDER.findIndex((s) => s === statusValue);
}

/**
 * Get the next status in the delivery lifecycle
 * Returns null if already at terminal status (COMPLETED)
 */
export function getNextStatus(current: DriverStatus | string | null | undefined): DriverStatus | null {
  const currentIndex = getStatusIndex(current);

  // If no current status, start at ASSIGNED
  if (currentIndex === -1) {
    return DriverStatus.ASSIGNED;
  }

  // If at the last status (COMPLETED), no next status
  if (currentIndex >= STATUS_ORDER.length - 1) {
    return null;
  }

  // Safe to access since we've verified the index is within bounds
  const nextStatus = STATUS_ORDER[currentIndex + 1];
  return nextStatus ?? null;
}

/**
 * Check if a transition from one status to another is valid
 * Only allows sequential forward transitions
 */
export function canTransitionTo(
  from: DriverStatus | string | null | undefined,
  to: DriverStatus | string
): boolean {
  const fromIndex = getStatusIndex(from);
  const toIndex = getStatusIndex(to);

  // Can only transition to the immediate next status
  // Special case: if no current status (null/-1), can transition to ASSIGNED
  if (fromIndex === -1) {
    return toIndex === 0; // Can only go to ASSIGNED
  }

  return toIndex === fromIndex + 1;
}

/**
 * Check if a status can be advanced (not at terminal state)
 */
export function canAdvanceStatus(current: DriverStatus | string | null | undefined): boolean {
  return getNextStatus(current) !== null;
}

/**
 * Get the human-readable label for a status
 */
export function getStatusLabel(status: DriverStatus | string | null | undefined): string {
  if (!status) return 'Not Started';
  const statusKey = status as DriverStatus;
  return STATUS_LABELS[statusKey] || status;
}

/**
 * Get the action label for advancing to the next status
 */
export function getNextActionLabel(current: DriverStatus | string | null | undefined): string {
  const next = getNextStatus(current);
  if (!next) return 'Complete';

  // Return the action that will be performed (labeled by current status)
  if (!current) return 'Start';
  return NEXT_ACTION_LABELS[current as DriverStatus] || 'Next';
}

/**
 * Calculate progress percentage through the delivery lifecycle
 */
export function getStatusProgress(status: DriverStatus | string | null | undefined): number {
  const index = getStatusIndex(status);
  if (index === -1) return 0;

  // Calculate percentage (COMPLETED = 100%)
  return Math.round((index / (STATUS_ORDER.length - 1)) * 100);
}

/**
 * Check if a delivery is completed
 */
export function isDeliveryCompleted(status: DriverStatus | string | null | undefined): boolean {
  return status === DriverStatus.COMPLETED || status === 'COMPLETED';
}

/**
 * Statuses that trigger customer notifications
 */
export const CUSTOMER_NOTIFICATION_STATUSES: DriverStatus[] = [
  DriverStatus.ARRIVED_AT_VENDOR,
  DriverStatus.EN_ROUTE_TO_CLIENT,
  DriverStatus.ARRIVED_TO_CLIENT,
  DriverStatus.COMPLETED,
];

/**
 * Statuses that trigger admin notifications
 */
export const ADMIN_NOTIFICATION_STATUSES: DriverStatus[] = [
  DriverStatus.COMPLETED,
];

/**
 * Check if a status should trigger customer notification
 */
export function shouldNotifyCustomer(status: DriverStatus | string): boolean {
  return CUSTOMER_NOTIFICATION_STATUSES.includes(status as DriverStatus);
}

/**
 * Check if a status should trigger admin notification
 */
export function shouldNotifyAdmin(status: DriverStatus | string): boolean {
  return ADMIN_NOTIFICATION_STATUSES.includes(status as DriverStatus);
}
