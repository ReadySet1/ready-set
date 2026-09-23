/**
 * Battery level for GPS points. driver_locations.battery_level was null on
 * every point of a real drive: the web client only read navigator.getBattery
 * (absent in iOS Safari / WKWebView — expected null), and the native bridge
 * never read battery at all. These helpers are the single place both paths
 * read and the server validates the value.
 */
import {
  readBatteryLevel,
  BatteryLevelSchema,
  BATTERY_READ_TIMEOUT_MS,
  batteryStatusFor,
} from '../battery';

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

  it('resolves null after ~250ms when getBattery never settles (WebView stall)', async () => {
    jest.useFakeTimers();
    try {
      setGetBattery(jest.fn(() => new Promise(() => {})));
      const pending = readBatteryLevel();
      jest.advanceTimersByTime(BATTERY_READ_TIMEOUT_MS);
      await expect(pending).resolves.toBeNull();
      expect(BATTERY_READ_TIMEOUT_MS).toBeLessThanOrEqual(250);
    } finally {
      jest.useRealTimers();
    }
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

describe('batteryStatusFor', () => {
  it('treats a real 0% as critical, not as missing data', () => {
    expect(batteryStatusFor(0)).toEqual({ level: 0, status: 'critical' });
  });

  it.each([[null], [undefined]])('reports no level for %p', (level) => {
    expect(batteryStatusFor(level)).toEqual({ status: 'good' });
  });

  it('grades low and good levels', () => {
    expect(batteryStatusFor(25)).toEqual({ level: 25, status: 'low' });
    expect(batteryStatusFor(80)).toEqual({ level: 80, status: 'good' });
  });
});
