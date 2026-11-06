/**
 * Zone derivation for addresses and orders. `addresses.state` is dirty free
 * text on prod ("CALIFORNIA (95054)", "CAIFORNIA"), so the zone comes from the
 * ZIP prefix, then coordinates, then the app default (Pacific).
 */

import {
  timezoneFromZip,
  timezoneFromCoordinates,
  resolveAddressTimezone,
  orderTimezone,
  timezoneAbbreviation,
  orderTimesInPickupZone,
} from '../address-timezone';

const PACIFIC = 'America/Los_Angeles';
const CENTRAL = 'America/Chicago';
const MOUNTAIN = 'America/Denver';
const EASTERN = 'America/New_York';

describe('timezoneFromZip', () => {
  it('maps California ZIPs to Pacific', () => {
    expect(timezoneFromZip('94102')).toBe(PACIFIC); // San Francisco
    expect(timezoneFromZip('95054')).toBe(PACIFIC); // Santa Clara
    expect(timezoneFromZip('90001')).toBe(PACIFIC); // Los Angeles
    expect(timezoneFromZip('96162')).toBe(PACIFIC); // Truckee, last CA prefix
  });

  it('maps Texas ZIPs to Central', () => {
    expect(timezoneFromZip('78701')).toBe(CENTRAL); // Austin
    expect(timezoneFromZip('75201')).toBe(CENTRAL); // Dallas
    expect(timezoneFromZip('77002')).toBe(CENTRAL); // Houston
  });

  it('maps the El Paso corner of Texas to Mountain', () => {
    expect(timezoneFromZip('79901')).toBe(MOUNTAIN);
    expect(timezoneFromZip('79835')).toBe(MOUNTAIN);
    expect(timezoneFromZip('88540')).toBe(MOUNTAIN);
  });

  it('maps Georgia ZIPs to Eastern', () => {
    expect(timezoneFromZip('30303')).toBe(EASTERN); // Atlanta, Fulton county
    expect(timezoneFromZip('39901')).toBe(EASTERN);
  });

  it('tolerates ZIP+4, whitespace and a leading zero', () => {
    expect(timezoneFromZip(' 78701-1234 ')).toBe(CENTRAL);
    expect(timezoneFromZip('94102 ')).toBe(PACIFIC);
  });

  it('returns null for unknown, malformed or empty ZIPs', () => {
    expect(timezoneFromZip('10001')).toBeNull(); // New York, not in the table yet
    expect(timezoneFromZip('abc')).toBeNull();
    expect(timezoneFromZip('')).toBeNull();
    expect(timezoneFromZip(null)).toBeNull();
    expect(timezoneFromZip(undefined)).toBeNull();
  });
});

describe('timezoneFromCoordinates', () => {
  it('places CONUS longitudes in a coarse zone band', () => {
    expect(timezoneFromCoordinates(37.77, -122.42)).toBe(PACIFIC); // SF
    expect(timezoneFromCoordinates(39.74, -104.99)).toBe(MOUNTAIN); // Denver
    expect(timezoneFromCoordinates(30.27, -97.74)).toBe(CENTRAL); // Austin
    expect(timezoneFromCoordinates(33.75, -84.39)).toBe(EASTERN); // Atlanta
  });

  it('returns null outside CONUS or without both coordinates', () => {
    expect(timezoneFromCoordinates(21.3, -157.86)).toBeNull(); // Honolulu
    expect(timezoneFromCoordinates(null, -97.74)).toBeNull();
    expect(timezoneFromCoordinates(30.27, undefined)).toBeNull();
  });
});

describe('resolveAddressTimezone', () => {
  it('prefers the stored timezone over everything else', () => {
    expect(
      resolveAddressTimezone({ timezone: EASTERN, zip: '78701', latitude: 37.77, longitude: -122.42 }),
    ).toBe(EASTERN);
  });

  it('derives from ZIP before coordinates', () => {
    expect(resolveAddressTimezone({ zip: '78701', latitude: 37.77, longitude: -122.42 })).toBe(CENTRAL);
  });

  it('falls back to coordinates when the ZIP is unknown', () => {
    expect(resolveAddressTimezone({ zip: '10001', latitude: 30.27, longitude: -97.74 })).toBe(CENTRAL);
  });

  it('falls back to the app default when nothing matches', () => {
    expect(resolveAddressTimezone({ zip: '10001' })).toBe(PACIFIC);
    expect(resolveAddressTimezone({})).toBe(PACIFIC);
    expect(resolveAddressTimezone(null)).toBe(PACIFIC);
    expect(resolveAddressTimezone(undefined)).toBe(PACIFIC);
  });

  it('ignores an empty stored timezone', () => {
    expect(resolveAddressTimezone({ timezone: '', zip: '78701' })).toBe(CENTRAL);
    expect(resolveAddressTimezone({ timezone: null, zip: '78701' })).toBe(CENTRAL);
  });
});

describe('orderTimezone', () => {
  it('uses the pickup address zone', () => {
    expect(
      orderTimezone({
        pickupAddress: { zip: '78701' },
        deliveryAddress: { zip: '94102' },
      }),
    ).toBe(CENTRAL);
  });

  it('falls back to the app default without a pickup address', () => {
    expect(orderTimezone({})).toBe(PACIFIC);
    expect(orderTimezone({ pickupAddress: null })).toBe(PACIFIC);
    expect(orderTimezone(null)).toBe(PACIFIC);
  });
});

describe('timezoneAbbreviation', () => {
  it('returns the US short labels', () => {
    expect(timezoneAbbreviation(PACIFIC)).toBe('PT');
    expect(timezoneAbbreviation(CENTRAL)).toBe('CT');
    expect(timezoneAbbreviation(MOUNTAIN)).toBe('MT');
    expect(timezoneAbbreviation(EASTERN)).toBe('ET');
  });

  it('falls back to the Intl short name for other zones', () => {
    expect(timezoneAbbreviation('Asia/Tokyo', new Date('2026-10-08T06:30:00Z'))).toBe('GMT+9');
  });
});

describe('orderTimesInPickupZone', () => {
  // The create forms build Dates from the browser clock; their local fields are
  // the wall-clock the admin typed. 11:00 typed for Austin must save as 11:00 CDT.
  const typed = new Date(2026, 9, 8, 11, 0, 0, 0);
  const arrival = new Date(2026, 9, 8, 11, 30, 0, 0);

  it('re-reads pickup and arrival in the pickup address zone', () => {
    const out = orderTimesInPickupZone({
      pickupAddress: { zip: '78701' },
      pickupDateTime: typed,
      arrivalDateTime: arrival,
    });
    expect(out.pickupDateTime.toISOString()).toBe('2026-10-08T16:00:00.000Z');
    expect(out.arrivalDateTime.toISOString()).toBe('2026-10-08T16:30:00.000Z');
  });

  it('uses Pacific for a California pickup', () => {
    const out = orderTimesInPickupZone({ pickupAddress: { zip: '94102' }, pickupDateTime: typed });
    expect(out.pickupDateTime.toISOString()).toBe('2026-10-08T18:00:00.000Z');
  });

  it('leaves missing fields alone and keeps the rest of the payload', () => {
    const out = orderTimesInPickupZone({
      pickupAddress: { zip: '78701' },
      pickupDateTime: typed,
      arrivalDateTime: undefined,
      completeDateTime: null,
      clientAttention: 'Jane',
    });
    expect(out.arrivalDateTime).toBeUndefined();
    expect(out.completeDateTime).toBeNull();
    expect(out.clientAttention).toBe('Jane');
    expect(Object.keys(out)).toEqual(['pickupAddress', 'pickupDateTime', 'arrivalDateTime', 'completeDateTime', 'clientAttention']);
  });
});
