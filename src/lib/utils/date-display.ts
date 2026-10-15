import { format, toZonedTime } from 'date-fns-tz';
import { TIMEZONE_CONFIG } from '@/lib/config/timezone';

/**
 * ISO-8601 zone designator at the tail of a string: `Z`, `±HH:MM` or `±HHMM`.
 * A string without one is "naive" wall-clock time and is formatted as-is.
 */
const ZONE_DESIGNATOR_RE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Format an absolute instant for display in the app timezone
 * (TIMEZONE_CONFIG.LOCAL_TIMEZONE), never the viewer's browser timezone.
 * @param utcDate - Date, or ISO string (`Z` / explicit offset = absolute; no designator = naive)
 * @param formatStr - Format string for date-fns (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted date string in the app timezone
 */
export function formatDateTimeForDisplay(
  utcDate: string | Date | null | undefined,
  formatStr: string = 'MMM d, yyyy h:mm a'
): string {
  if (!utcDate) return 'N/A';

  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    if (Number.isNaN(date.getTime())) {
      throw new RangeError(`Invalid date value: ${String(utcDate)}`);
    }

    // A naive string carries no zone designator: it is already wall-clock time.
    if (typeof utcDate === 'string' && !ZONE_DESIGNATOR_RE.test(utcDate.trim())) {
      return format(date, formatStr);
    }

    const timeZone = TIMEZONE_CONFIG.LOCAL_TIMEZONE;
    return format(toZonedTime(date, timeZone), formatStr, { timeZone });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format just the date part for display
 */
export function formatDateForDisplay(utcDate: string | Date | null | undefined): string {
  return formatDateTimeForDisplay(utcDate, 'MMM d, yyyy');
}

/**
 * Format just the time part for display
 */
export function formatTimeForDisplay(utcDate: string | Date | null | undefined): string {
  return formatDateTimeForDisplay(utcDate, 'h:mm a');
}

/**
 * Get relative time (e.g., "2 hours ago", "in 30 minutes")
 */
export function getRelativeTime(utcDate: string | Date | null | undefined): string {
  if (!utcDate) return 'N/A';
  
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.floor(Math.abs(diffMs) / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMs < 0) {
      // Past
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin} min ago`;
      if (diffHours < 24) return `${diffHours} hr ago`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      // Future
      if (diffMin < 1) return 'Now';
      if (diffMin < 60) return `In ${diffMin} min`;
      if (diffHours < 24) return `In ${diffHours} hr`;
      return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return 'Invalid Date';
  }
} 