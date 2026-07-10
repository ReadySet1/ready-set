import {
  TrackingSettingsSchema,
  TRACKING_SETTINGS_DEFAULTS,
} from '../tracking-settings';

describe('TrackingSettingsSchema', () => {
  it('accepts the defaults object', () => {
    const parsed = TrackingSettingsSchema.safeParse(TRACKING_SETTINGS_DEFAULTS);
    expect(parsed.success).toBe(true);
  });

  it('defaults mirror the historical hardcoded values', () => {
    expect(TRACKING_SETTINGS_DEFAULTS).toEqual({
      arrivalGeofenceRadiusM: 150,
      staleGpsThresholdSeconds: 300,
      endShiftPickupGuardMinutes: 120,
      locationUpdateIntervalSeconds: 5,
      mileageGpsAccuracyThresholdM: 100,
      mileageMaxSpeedMph: 95,
      maxReasonableShiftMiles: 310,
    });
  });

  it.each([
    ['arrivalGeofenceRadiusM', 14, 1610],
    ['staleGpsThresholdSeconds', 59, 3601],
    ['endShiftPickupGuardMinutes', -1, 1441],
    ['locationUpdateIntervalSeconds', 1, 61],
    ['mileageGpsAccuracyThresholdM', 9, 501],
    ['mileageMaxSpeedMph', 29, 151],
    ['maxReasonableShiftMiles', 49, 2001],
  ])('rejects out-of-bounds %s', (field, below, above) => {
    for (const bad of [below, above]) {
      const parsed = TrackingSettingsSchema.safeParse({
        ...TRACKING_SETTINGS_DEFAULTS,
        [field]: bad,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('allows 0 for the end-shift pickup guard (disables it)', () => {
    const parsed = TrackingSettingsSchema.safeParse({
      ...TRACKING_SETTINGS_DEFAULTS,
      endShiftPickupGuardMinutes: 0,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-integer and missing values', () => {
    expect(
      TrackingSettingsSchema.safeParse({
        ...TRACKING_SETTINGS_DEFAULTS,
        arrivalGeofenceRadiusM: 150.5,
      }).success,
    ).toBe(false);
    const { arrivalGeofenceRadiusM: _omitted, ...partial } =
      TRACKING_SETTINGS_DEFAULTS;
    expect(TrackingSettingsSchema.safeParse(partial).success).toBe(false);
  });
});
