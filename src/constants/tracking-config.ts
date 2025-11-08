/**
 * Configuration constants for the driver tracking map
 *
 * These values control map behavior, zoom levels, animations, and other
 * map-related settings. Centralized here for easy tuning and consistency.
 */

export const MAP_CONFIG = {
  /** Default zoom level for normal map view */
  DEFAULT_ZOOM: 12,
  /** Zoom level for compact map display */
  COMPACT_ZOOM: 10,
  /** Padding around bounds when fitting multiple markers (in pixels) */
  BOUNDS_PADDING: 50,
  /** Maximum zoom level when auto-fitting to markers */
  MAX_AUTO_ZOOM: 15,
  /** Duration of fit bounds animation (in milliseconds) */
  FIT_BOUNDS_DURATION: 1000,
  /** Default map center coordinates [lng, lat] - San Francisco */
  DEFAULT_CENTER: [-122.4194, 37.7749] as [number, number],
} as const;

export const MARKER_CONFIG = {
  /** Size of driver marker icons (in pixels) */
  DRIVER_MARKER_SIZE: 32,
  /** Size of delivery marker icons (in pixels) */
  DELIVERY_MARKER_SIZE: 24,
  /** Popup offset from marker (in pixels) */
  POPUP_OFFSET: 25,
  /** Maximum width of popup content (in pixels) */
  POPUP_MAX_WIDTH: 100,
} as const;

export const BATTERY_THRESHOLDS = {
  /** Battery level below which is considered critical (percentage) */
  CRITICAL: 15,
  /** Battery level below which is considered low (percentage) */
  LOW: 30,
} as const;
