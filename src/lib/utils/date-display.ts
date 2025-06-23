import { format } from 'date-fns';
import { utcToLocalTime } from './timezone';

/**
 * Format a UTC date/time for display in local timezone
 * @param utcDate - UTC date string or Date object
 * @param formatStr - Format string for date-fns (default: 'MMM d, yyyy h:mm a')
 * @returns Formatted date string in local timezone
 */
export function formatDateTimeForDisplay(
  utcDate: string | Date | null | undefined,
  formatStr: string = 'MMM d, yyyy h:mm a'
): string {
  if (!utcDate) return 'N/A';
  
  try {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    
    // If the date is already in local timezone (no 'Z' suffix), format directly
    if (typeof utcDate === 'string' && !utcDate.endsWith('Z')) {
      return format(date, formatStr);
    }
    
    // Convert UTC to local time for display
    const { date: localDate, time: localTime } = utcToLocalTime(date);
    const localDateTime = new Date(`${localDate}T${localTime}`);
    
    return format(localDateTime, formatStr);
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