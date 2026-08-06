jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    trackingSettings: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
}));

import { prisma } from '@/utils/prismaDB';
import * as Sentry from '@sentry/nextjs';
import {
  getTrackingSettings,
  invalidateTrackingSettingsCache,
} from '../tracking-settings';
import { TRACKING_SETTINGS_DEFAULTS } from '@/types/tracking-settings';

const findUnique = prisma.trackingSettings.findUnique as jest.Mock;

const dbRow = {
  id: 1,
  arrivalGeofenceRadiusM: 90,
  staleGpsThresholdSeconds: 120,
  endShiftPickupGuardMinutes: 60,
  locationUpdateIntervalSeconds: 10,
  mileageGpsAccuracyThresholdM: 50,
  mileageMaxSpeedMph: 80,
  maxReasonableShiftMiles: 500,
  updatedAt: new Date(),
  updatedBy: 'admin-user-id',
};

describe('getTrackingSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateTrackingSettingsCache();
  });

  it('returns the DB row values stripped to the settings shape', async () => {
    findUnique.mockResolvedValue(dbRow);
    const settings = await getTrackingSettings();
    expect(settings).toEqual({
      arrivalGeofenceRadiusM: 90,
      staleGpsThresholdSeconds: 120,
      endShiftPickupGuardMinutes: 60,
      locationUpdateIntervalSeconds: 10,
      mileageGpsAccuracyThresholdM: 50,
      mileageMaxSpeedMph: 80,
      maxReasonableShiftMiles: 500,
    });
  });

  it('returns defaults when the row is missing', async () => {
    findUnique.mockResolvedValue(null);
    await expect(getTrackingSettings()).resolves.toEqual(
      TRACKING_SETTINGS_DEFAULTS,
    );
  });

  it('fails open to defaults (no throw) when the DB errors, and reports to Sentry', async () => {
    findUnique.mockRejectedValue(new Error('relation does not exist'));
    await expect(getTrackingSettings()).resolves.toEqual(
      TRACKING_SETTINGS_DEFAULTS,
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('caches within the TTL (single DB hit) and refetches after invalidation', async () => {
    findUnique.mockResolvedValue(dbRow);
    await getTrackingSettings();
    await getTrackingSettings();
    expect(findUnique).toHaveBeenCalledTimes(1);

    invalidateTrackingSettingsCache();
    await getTrackingSettings();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('caches the defaults after a DB error too (does not hammer a down DB)', async () => {
    findUnique.mockRejectedValue(new Error('down'));
    await getTrackingSettings();
    await getTrackingSettings();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
