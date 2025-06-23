import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { TIMEZONE_CONFIG } from '@/lib/config/timezone';

/**
 * Convert local time string to UTC ISO string
 * @param localDate - Date in YYYY-MM-DD format
 * @param localTime - Time in HH:MM format
 * @param timezone - Timezone (defaults to configured local timezone)
 * @returns UTC ISO string with 'Z' suffix
 */
export function localTimeToUtc(
  localDate: string, 
  localTime: string, 
  timezone: string = TIMEZONE_CONFIG.LOCAL_TIMEZONE
): string {
  // Create date string in local timezone
  const localDateTime = `${localDate} ${localTime}`;
  
  // Convert from local timezone to UTC
  const utcDate = fromZonedTime(localDateTime, timezone);
  return utcDate.toISOString();
}

/**
 * Convert UTC date to local time components
 * @param utcDate - UTC Date or ISO string
 * @param timezone - Target timezone (defaults to configured local timezone)
 * @returns Object with date and time strings
 */
export function utcToLocalTime(
  utcDate: Date | string, 
  timezone: string = TIMEZONE_CONFIG.LOCAL_TIMEZONE
): { date: string; time: string } {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  const zonedDate = toZonedTime(date, timezone);
  
  return {
    date: format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone }),
    time: format(zonedDate, 'HH:mm', { timeZone: timezone }),
  };
} 