import { z } from 'zod';
import { BATTERY_THRESHOLDS } from '@/constants/tracking-config';

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

/**
 * Upper bound on a battery read. Some WebViews expose getBattery() but never
 * settle it; the GPS post awaits this read, so it must not stall.
 */
export const BATTERY_READ_TIMEOUT_MS = 250;

/**
 * Reads the battery level as a 0-100 integer, or null when unavailable or
 * slower than BATTERY_READ_TIMEOUT_MS. Never throws.
 */
export function readBatteryLevel(): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), BATTERY_READ_TIMEOUT_MS);
  });
  return Promise.race([readBatteryLevelUnbounded(), timeout]).finally(() =>
    clearTimeout(timer),
  );
}

async function readBatteryLevelUnbounded(): Promise<number | null> {
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

export type BatteryStatus = 'good' | 'low' | 'critical';

/**
 * Grades a battery level for display. Compares against null/undefined, never
 * truthiness, so a real 0% is shown as critical rather than as "no data".
 */
export function batteryStatusFor(
  level: number | null | undefined,
): { level?: number; status: BatteryStatus } {
  if (level == null) return { status: 'good' };
  if (level <= BATTERY_THRESHOLDS.CRITICAL) return { level, status: 'critical' };
  if (level <= BATTERY_THRESHOLDS.LOW) return { level, status: 'low' };
  return { level, status: 'good' };
}
