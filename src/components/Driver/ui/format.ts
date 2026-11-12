/** Shared formatting helpers for the driver UI. */

import { timezoneAbbreviation } from "@/lib/utils/address-timezone";
import { formatDateTimeForDisplay } from "@/lib/utils/date-display";

/** Seconds → "H:MM:SS" (or "M:SS" under an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Seconds → compact "Xh Ym" / "Ym". */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format a Date/ISO as an "h:mm AM" time. With `timeZone` the time is read on
 * that clock (an order's pickup-address zone); without it, on the device clock.
 */
export function formatTime(
  value: Date | string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  if (timeZone) return formatDateTimeForDisplay(d, "h:mm a", timeZone);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * An order time on the order's own clock with its zone label ("11:00 AM CT"),
 * so a driver never reads an Austin pickup on the Pacific clock.
 */
export function formatOrderTime(
  value: Date | string | null | undefined,
  timeZone: string,
): string {
  const time = formatTime(value, timeZone);
  return time ? `${time} ${timezoneAbbreviation(timeZone)}` : "";
}
