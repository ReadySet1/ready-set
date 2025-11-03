/**
 * Color constants for the driver tracking system
 *
 * These colors are used throughout the tracking UI to represent different
 * driver and delivery states. Using Tailwind color tokens for consistency.
 */

export const DRIVER_STATUS_COLORS = {
  /** Driver is actively moving - green-500 */
  moving: '#22c55e',
  /** Driver is stopped/stationary - yellow-500 */
  stationary: '#eab308',
  /** Driver is on duty but not moving - blue-500 */
  onDuty: '#3b82f6',
  /** Driver is off duty - gray-400 */
  offDuty: '#94a3b8',
} as const;

export const BATTERY_STATUS_COLORS = {
  /** Battery level is good (>50%) - green-500 */
  good: '#22c55e',
  /** Battery level is low (20-50%) - yellow-500 */
  low: '#eab308',
  /** Battery level is critical (<20%) - red-500 */
  critical: '#ef4444',
} as const;

export const DELIVERY_MARKER_COLOR = '#f97316'; // orange-500

export type DriverStatusColor = typeof DRIVER_STATUS_COLORS[keyof typeof DRIVER_STATUS_COLORS];
export type BatteryStatusColor = typeof BATTERY_STATUS_COLORS[keyof typeof BATTERY_STATUS_COLORS];
