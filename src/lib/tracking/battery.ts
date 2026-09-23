import { z } from 'zod';

/**
 * Device battery level for GPS points (driver_locations.battery_level).
 *
 * Client side: the W3C Battery Status API (`navigator.getBattery`) is the only
 * source available with the current dependencies. It exists in Chrome/Android
 * (including the Android System WebView the Capacitor wrapper uses) but NOT in
 * iOS Safari or WKWebView, so iOS always reports null — expected, not an error.
 */

interface BatteryManagerLike {
  level?: unknown;
}

/** Reads the battery level as a 0-100 integer, or null when unavailable. Never throws. */
export async function readBatteryLevel(): Promise<number | null> {
  try {
    if (typeof navigator === 'undefined' || !('getBattery' in navigator)) return null;
    const getBattery = (navigator as { getBattery?: () => Promise<BatteryManagerLike> })
      .getBattery;
    if (typeof getBattery !== 'function') return null;
    const battery = await getBattery.call(navigator);
    const level = battery?.level;
    if (typeof level !== 'number' || !Number.isFinite(level)) return null;
    return Math.min(100, Math.max(0, Math.round(level * 100)));
  } catch {
    return null;
  }
}

/**
 * Server-side validation for the POSTed `battery_level`: a finite number in
 * 0-100, rounded to an integer (the column is INT). Anything else becomes null
 * rather than rejecting the request — a bad battery reading must never cost us
 * the GPS point.
 */
export const BatteryLevelSchema = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .transform((v) => Math.round(v))
  .nullable()
  .catch(null)
  .transform((v) => v ?? null);
