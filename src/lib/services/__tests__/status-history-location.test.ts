/**
 * Tests for the position recorded on order_status_history rows.
 *
 * Product decision (2026-11): the server fills `location` from the driver's
 * latest driver_locations point when it is no older than the tracking
 * settings' stale-GPS threshold; a client-sent point is only the fallback;
 * with neither the location stays null and the status change is never blocked.
 */

jest.mock('@/utils/prismaDB', () => ({
  prisma: { $queryRawUnsafe: jest.fn() },
}));
jest.mock('@/services/tracking/tracking-settings', () => ({
  getTrackingSettings: jest.fn(),
}));
jest.mock('@/lib/logging/realtime-logger', () => ({
  realtimeLogger: { error: jest.fn(), warn: jest.fn() },
}));
// The real ownership fragment is used; only its server-only deps are stubbed.
jest.mock('next/headers', () => ({ headers: jest.fn() }));
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/auth', () => ({ getUserRole: jest.fn() }));

import { prisma } from '@/utils/prismaDB';
import { getTrackingSettings } from '@/services/tracking/tracking-settings';
import { realtimeLogger } from '@/lib/logging/realtime-logger';
import { existingDriverOwnershipCondition } from '@/lib/auth/driver-ownership';
import { TRACKING_SETTINGS_DEFAULTS } from '@/types/tracking-settings';
import {
  parseClientLocation,
  resolveStatusHistoryLocation,
} from '../status-history-location';

const mockedQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockedSettings = jest.mocked(getTrackingSettings);

const NOW = new Date('2026-11-03T18:00:00.000Z');
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000);
const CLIENT = { lat: 37.1, lng: -122.1 };

beforeEach(() => {
  jest.clearAllMocks();
  mockedSettings.mockResolvedValue({ ...TRACKING_SETTINGS_DEFAULTS, staleGpsThresholdSeconds: 300 });
});

describe('resolveStatusHistoryLocation', () => {
  it('uses a fresh server point, even when the client also sent one', async () => {
    mockedQuery.mockResolvedValue([
      { latitude: 37.7749, longitude: -122.4194, recorded_at: secondsAgo(30) },
    ]);

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', clientLocation: CLIENT, now: NOW }),
    ).resolves.toEqual({ lat: 37.7749, lng: -122.4194 });
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), 'profile-1');
  });

  it('falls back to the client point when the server point is older than the stale threshold', async () => {
    mockedQuery.mockResolvedValue([
      { latitude: 37.7749, longitude: -122.4194, recorded_at: secondsAgo(301) },
    ]);

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', clientLocation: CLIENT, now: NOW }),
    ).resolves.toEqual(CLIENT);
  });

  it('reads the max age from the tracking settings (staleGpsThresholdSeconds)', async () => {
    mockedSettings.mockResolvedValue({ ...TRACKING_SETTINGS_DEFAULTS, staleGpsThresholdSeconds: 60 });
    mockedQuery.mockResolvedValue([
      { latitude: 37.7749, longitude: -122.4194, recorded_at: secondsAgo(90) },
    ]);

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', now: NOW }),
    ).resolves.toBeNull();
  });

  it('returns null when there is neither a server point nor a client point', async () => {
    mockedQuery.mockResolvedValue([]);

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', now: NOW }),
    ).resolves.toBeNull();
  });

  it('returns null when the server point is stale and the client sent nothing', async () => {
    mockedQuery.mockResolvedValue([
      { latitude: 37.7749, longitude: -122.4194, recorded_at: secondsAgo(3600) },
    ]);

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', clientLocation: null, now: NOW }),
    ).resolves.toBeNull();
  });

  it('ignores soft-deleted points and soft-deleted drivers, resolving the driver via the ownership module', async () => {
    mockedQuery.mockResolvedValue([]);

    await resolveStatusHistoryLocation({ driverProfileId: 'profile-1', now: NOW });

    const sql = mockedQuery.mock.calls[0][0] as string;
    // profile_id OR user_id, and drivers.deleted_at IS NULL — the module's fragment.
    expect(sql).toContain(existingDriverOwnershipCondition(1, 'd'));
    expect(sql).toMatch(/dl\.deleted_at IS NULL/);
    expect(sql).toMatch(/ORDER BY dl\.recorded_at DESC/);
    expect(sql).toMatch(/LIMIT 1/);
  });

  it('never throws: a lookup failure is logged and falls back to the client point', async () => {
    mockedQuery.mockRejectedValue(new Error('db down'));

    await expect(
      resolveStatusHistoryLocation({ driverProfileId: 'profile-1', clientLocation: CLIENT, now: NOW }),
    ).resolves.toEqual(CLIENT);
    expect(jest.mocked(realtimeLogger.warn)).toHaveBeenCalled();
  });

  it('skips the lookup when no driver is known and uses the client point', async () => {
    await expect(
      resolveStatusHistoryLocation({ driverProfileId: null, clientLocation: CLIENT, now: NOW }),
    ).resolves.toEqual(CLIENT);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('ignores an out-of-range client point', async () => {
    mockedQuery.mockResolvedValue([]);

    await expect(
      resolveStatusHistoryLocation({
        driverProfileId: 'profile-1',
        clientLocation: { lat: 120, lng: 10 },
        now: NOW,
      }),
    ).resolves.toBeNull();
  });
});

describe('parseClientLocation', () => {
  it('accepts { lat, lng } and { latitude, longitude }', () => {
    expect(parseClientLocation({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 });
    expect(parseClientLocation({ latitude: 1, longitude: 2 })).toEqual({ lat: 1, lng: 2 });
  });

  it('rejects anything else', () => {
    expect(parseClientLocation(undefined)).toBeNull();
    expect(parseClientLocation('37,-122')).toBeNull();
    expect(parseClientLocation({ lat: '1', lng: 2 })).toBeNull();
    expect(parseClientLocation({ lat: Number.NaN, lng: 2 })).toBeNull();
    expect(parseClientLocation({ lat: 10, lng: 200 })).toBeNull();
  });
});
