/**
 * Battery level for GPS points. driver_locations.battery_level was null on
 * every point of a real drive: the web client only read navigator.getBattery
 * (absent in iOS Safari / WKWebView — expected null), and the native bridge
 * never read battery at all. These helpers are the single place both paths
 * read and the server validates the value.
 */
import { readBatteryLevel, BatteryLevelSchema } from '../battery';

const setGetBattery = (value: unknown) => {
  Object.defineProperty(navigator, 'getBattery', {
    value,
    configurable: true,
    writable: true,
  });
};

describe('readBatteryLevel', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).getBattery;
  });

  it('returns a 0-100 integer when the Battery Status API is present', async () => {
    setGetBattery(jest.fn().mockResolvedValue({ level: 0.873 }));
    await expect(readBatteryLevel()).resolves.toBe(87);
  });

  it('returns null when the Battery Status API is absent (iOS Safari / WKWebView)', async () => {
    delete (navigator as unknown as Record<string, unknown>).getBattery;
    expect('getBattery' in navigator).toBe(false);
    await expect(readBatteryLevel()).resolves.toBeNull();
  });

  it('returns null instead of throwing when getBattery rejects', async () => {
    setGetBattery(jest.fn().mockRejectedValue(new Error('NotAllowedError')));
    await expect(readBatteryLevel()).resolves.toBeNull();
  });

  it('returns null for a non-numeric level', async () => {
    setGetBattery(jest.fn().mockResolvedValue({ level: undefined }));
    await expect(readBatteryLevel()).resolves.toBeNull();
  });
});

describe('BatteryLevelSchema', () => {
  it.each([
    [87, 87],
    [87.6, 88],
    [0, 0],
    [100, 100],
  ])('accepts %p as %p', (input, expected) => {
    expect(BatteryLevelSchema.parse(input)).toBe(expected);
  });

  it.each([[null], [undefined], [-1], [101], ['87'], [Number.NaN], [{}]])(
    'normalizes invalid %p to null instead of rejecting the GPS point',
    (input) => {
      expect(BatteryLevelSchema.parse(input)).toBeNull();
    },
  );
});
