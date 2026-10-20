/**
 * formatDateTimeForDisplay must render every absolute instant in the app
 * timezone (TIMEZONE_CONFIG.LOCAL_TIMEZONE, Pacific), whether the input is a
 * Date, a `Z` ISO string, or an ISO string with an explicit `±HH:MM` offset.
 * Only a naive string (no zone designator at all) is treated as already-local.
 *
 * The fixture instant straddles midnight: 2026-10-08T06:30Z is Oct 7, 11:30 PM
 * in Pacific, so a conversion in any other zone changes the calendar day.
 */

import {
  formatDateTimeForDisplay,
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateTimeWithZone,
} from '../date-display';

const PACIFIC_DATETIME = 'Oct 7, 2026 11:30 PM';
const PACIFIC_DATE = 'Oct 7, 2026';
const PACIFIC_TIME = '11:30 PM';

describe('formatDateTimeForDisplay', () => {
  it('converts a Z-suffixed ISO string to Pacific', () => {
    expect(formatDateTimeForDisplay('2026-10-08T06:30:00Z')).toBe(PACIFIC_DATETIME);
    expect(formatDateTimeForDisplay('2026-10-08T06:30:00.000Z')).toBe(PACIFIC_DATETIME);
  });

  it('converts a +00:00 offset string exactly like the Z form', () => {
    expect(formatDateTimeForDisplay('2026-10-08T06:30:00+00:00')).toBe(
      formatDateTimeForDisplay('2026-10-08T06:30:00Z'),
    );
    expect(formatDateTimeForDisplay('2026-10-08T06:30:00+00:00')).toBe(PACIFIC_DATETIME);
  });

  it('converts a non-UTC offset string to the same Pacific instant', () => {
    // Same instant as 06:30Z, written in Pacific daylight time.
    expect(formatDateTimeForDisplay('2026-10-07T23:30:00-07:00')).toBe(PACIFIC_DATETIME);
    // Same instant, written in Tokyo time; compact ±HHMM form.
    expect(formatDateTimeForDisplay('2026-10-08T15:30:00+0900')).toBe(PACIFIC_DATETIME);
  });

  it('formats a naive string (no zone designator) as-is', () => {
    expect(formatDateTimeForDisplay('2026-10-08T11:00:00')).toBe('Oct 8, 2026 11:00 AM');
  });

  it('converts a Date object to Pacific', () => {
    expect(formatDateTimeForDisplay(new Date('2026-10-08T06:30:00Z'))).toBe(PACIFIC_DATETIME);
  });

  it('returns N/A for null and undefined, Invalid Date for garbage', () => {
    expect(formatDateTimeForDisplay(null)).toBe('N/A');
    expect(formatDateTimeForDisplay(undefined)).toBe('N/A');
    expect(formatDateTimeForDisplay('')).toBe('N/A');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(formatDateTimeForDisplay('not a date')).toBe('Invalid Date');
    consoleError.mockRestore();
  });
});

describe('formatDateForDisplay / formatTimeForDisplay', () => {
  it('apply the same Pacific conversion to the date-only and time-only forms', () => {
    expect(formatDateForDisplay('2026-10-08T06:30:00Z')).toBe(PACIFIC_DATE);
    expect(formatDateForDisplay('2026-10-08T06:30:00+00:00')).toBe(PACIFIC_DATE);
    expect(formatTimeForDisplay('2026-10-08T06:30:00Z')).toBe(PACIFIC_TIME);
    expect(formatTimeForDisplay('2026-10-08T06:30:00+00:00')).toBe(PACIFIC_TIME);
  });
});

describe('per-location timezone', () => {
  const CENTRAL = 'America/Chicago';

  it('formats in the given zone instead of the app default', () => {
    // 2026-10-08T16:00Z = 11:00 AM CDT = 9:00 AM PDT
    expect(formatDateTimeForDisplay('2026-10-08T16:00:00Z', 'MMM d, yyyy h:mm a', CENTRAL)).toBe(
      'Oct 8, 2026 11:00 AM',
    );
    expect(formatDateTimeForDisplay('2026-10-08T16:00:00Z')).toBe('Oct 8, 2026 9:00 AM');
  });

  it('keeps the calendar day of the given zone in the date-only and time-only forms', () => {
    // 06:30Z is still Oct 8, 1:30 AM in Central but Oct 7 in Pacific.
    expect(formatDateForDisplay('2026-10-08T06:30:00Z', CENTRAL)).toBe('Oct 8, 2026');
    expect(formatDateForDisplay('2026-10-08T06:30:00Z')).toBe(PACIFIC_DATE);
    expect(formatTimeForDisplay('2026-10-08T06:30:00Z', CENTRAL)).toBe('1:30 AM');
  });

  it('appends the zone label with formatDateTimeWithZone', () => {
    expect(formatDateTimeWithZone('2026-10-08T16:00:00Z', CENTRAL)).toBe('Oct 8, 2026 11:00 AM CT');
    expect(formatDateTimeWithZone('2026-10-08T16:00:00Z', 'America/Los_Angeles', 'h:mm a')).toBe(
      '9:00 AM PT',
    );
    expect(formatDateTimeWithZone(null, CENTRAL)).toBe('N/A');
  });
});
