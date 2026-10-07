import { setZonedTime, setZonedDate, zonedCalendarDay, utcToLocalTime } from '../timezone';

const LA = 'America/Los_Angeles';

describe('setZonedTime', () => {
  it('sets time during PDT (UTC-7)', () => {
    // 2026-10-07T20:00:00Z = 1:00 PM PDT → set to 2:00 PM PDT = 21:00 UTC
    const result = setZonedTime(new Date('2026-10-07T20:00:00Z'), '14:00', LA);
    expect(result.toISOString()).toBe('2026-10-07T21:00:00.000Z');
  });

  it('sets time during PST (UTC-8)', () => {
    // 2026-12-01T21:00:00Z = 1:00 PM PST → set to 2:00 PM PST = 22:00 UTC
    const result = setZonedTime(new Date('2026-12-01T21:00:00Z'), '14:00', LA);
    expect(result.toISOString()).toBe('2026-12-01T22:00:00.000Z');
  });

  it('keeps the Pacific calendar day for late-night instants', () => {
    // 2026-10-08T06:30:00Z = Oct 7, 11:30 PM PDT → set to 11:45 PM = 06:45 UTC
    const result = setZonedTime(new Date('2026-10-08T06:30:00Z'), '23:45', LA);
    expect(result.toISOString()).toBe('2026-10-08T06:45:00.000Z');
  });
});

describe('setZonedDate', () => {
  it('keeps the wall-clock time when changing day', () => {
    // 2026-10-07T20:00:00Z = 1:00 PM PDT → move to Oct 8, still 1:00 PM PDT = 20:00 UTC
    const result = setZonedDate(new Date('2026-10-07T20:00:00Z'), '2026-10-08', LA);
    expect(result.toISOString()).toBe('2026-10-08T20:00:00.000Z');
  });

  it('keeps wall-clock time across DST end (PDT → PST)', () => {
    // 2026-10-07T20:00:00Z = 1:00 PM PDT → move to Nov 2 (PST), still 1:00 PM = 21:00 UTC
    const result = setZonedDate(new Date('2026-10-07T20:00:00Z'), '2026-11-02', LA);
    expect(result.toISOString()).toBe('2026-11-02T21:00:00.000Z');
  });

  it('uses fallback time when instant is null', () => {
    // null → Oct 8, 12:00 PM PDT = 19:00 UTC
    const result = setZonedDate(null, '2026-10-08', LA);
    expect(result.toISOString()).toBe('2026-10-08T19:00:00.000Z');
  });
});

describe('zonedCalendarDay', () => {
  it('returns the Pacific calendar day as a browser-local midnight Date', () => {
    // 2026-10-08T06:30:00Z = Oct 7, 11:30 PM PDT → calendar day is Oct 7
    const result = zonedCalendarDay(new Date('2026-10-08T06:30:00Z'), LA);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9); // 0-indexed: 9 = October
    expect(result.getDate()).toBe(7);
  });
});

describe('round trip', () => {
  it('setZonedTime → utcToLocalTime recovers the original time', () => {
    const instant = new Date('2026-10-07T20:00:00Z');
    const updated = setZonedTime(instant, '09:05', LA);
    expect(utcToLocalTime(updated, LA).time).toBe('09:05');
  });
});
