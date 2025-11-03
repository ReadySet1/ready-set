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
  /** Default map center coordinates [lng, lat] - Los Angeles */
  DEFAULT_CENTER: [-118.2437, 34.0522] as [number, number],
} as const;

export const MARKER_CONFIG = {
  /** Size of driver marker icons (in pixels) */
  DRIVER_MARKER_SIZE: 32,
  /** Size of delivery marker icons (in pixels) */
  DELIVERY_MARKER_SIZE: 24,
  /** Popup offset from marker (in pixels) */
  POPUP_OFFSET: 25,
} as const;
