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

/**
 * Replace the wall-clock time of an instant, keeping its calendar day.
 * Both are read in `timezone`, never in the browser's timezone.
 * @param time - "HH:mm" (24h), the format <input type="time"> emits
 */
export function setZonedTime(
  instant: Date,
  time: string,
  timezone: string = TIMEZONE_CONFIG.LOCAL_TIMEZONE,
): Date {
  const { date } = utcToLocalTime(instant, timezone);
  return fromZonedTime(`${date} ${time}`, timezone);
}

/**
 * Replace the calendar day of an instant, keeping its wall-clock time.
 * @param day - "yyyy-MM-dd"
 * @param fallbackTime - used when there is no current value
 */
export function setZonedDate(
  instant: Date | null,
  day: string,
  timezone: string = TIMEZONE_CONFIG.LOCAL_TIMEZONE,
  fallbackTime: string = '12:00',
): Date {
  const time = instant ? utcToLocalTime(instant, timezone).time : fallbackTime;
  return fromZonedTime(`${day} ${time}`, timezone);
}

/**
 * The calendar day of an instant in `timezone`, returned as a browser-local Date at
 * midnight. This is the shape react-day-picker expects for `selected`: it only looks
 * at the local year/month/day of the Date it is given.
 */
export function zonedCalendarDay(
  instant: Date,
  timezone: string = TIMEZONE_CONFIG.LOCAL_TIMEZONE,
): Date {
  const { date } = utcToLocalTime(instant, timezone);
  const parts = date.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const dayNum = parts[2];
  if (year === undefined || month === undefined || dayNum === undefined) {
    throw new Error(`Malformed date string from utcToLocalTime: "${date}"`);
  }
  return new Date(year, month - 1, dayNum);
}