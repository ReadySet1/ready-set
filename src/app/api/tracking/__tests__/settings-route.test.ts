jest.mock('@/utils/prismaDB', () => ({
  prisma: {
    trackingSettings: {
      upsert: jest.fn(),
      // PUT reads the previous row directly (audit accuracy) — null means
      // "no row yet", which falls back to the mocked resolver.
      findUnique: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/auth-middleware');

jest.mock('@sentry/nextjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('@/services/tracking/tracking-settings', () => ({
  getTrackingSettings: jest.fn(),
  invalidateTrackingSettingsCache: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/tracking/settings/route';
import { prisma } from '@/utils/prismaDB';
import { withAuth } from '@/lib/auth-middleware';
import {
  getTrackingSettings,
  invalidateTrackingSettingsCache,
} from '@/services/tracking/tracking-settings';
import { TRACKING_SETTINGS_DEFAULTS } from '@/types/tracking-settings';

const mockWithAuth = withAuth as jest.Mock;
const mockGetSettings = getTrackingSettings as jest.Mock;
const mockUpsert = prisma.trackingSettings.upsert as jest.Mock;

const URL = 'http://localhost:3000/api/tracking/settings';

function authAs(type: string, id = 'user-1') {
  mockWithAuth.mockImplementation(async (_req, options) => {
    const allowed = (options?.allowedRoles ?? []).includes(type);
    if (!allowed) {
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
        }),
        context: {},
      };
    }
    return {
      success: true,
      context: { user: { id, email: `${id}@example.com`, type } },
    };
  });
}

function putRequest(body: unknown): NextRequest {
  return new NextRequest(URL, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GET /api/tracking/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
  });

  it('returns the client-relevant subset for a DRIVER (no mileage thresholds)', async () => {
    authAs('DRIVER');
    const response = await GET(new NextRequest(URL));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    // Mileage anti-gaming thresholds are withheld from drivers.
    expect(json.data).toEqual({
      arrivalGeofenceRadiusM: TRACKING_SETTINGS_DEFAULTS.arrivalGeofenceRadiusM,
      locationUpdateIntervalSeconds:
        TRACKING_SETTINGS_DEFAULTS.locationUpdateIntervalSeconds,
      staleGpsThresholdSeconds:
        TRACKING_SETTINGS_DEFAULTS.staleGpsThresholdSeconds,
      endShiftPickupGuardMinutes:
        TRACKING_SETTINGS_DEFAULTS.endShiftPickupGuardMinutes,
    });
  });

  it('returns the full settings for an ADMIN', async () => {
    authAs('ADMIN');
    const response = await GET(new NextRequest(URL));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual(TRACKING_SETTINGS_DEFAULTS);
  });

  it('rejects a CLIENT', async () => {
    authAs('CLIENT');
    const response = await GET(new NextRequest(URL));
    expect(response.status).toBe(403);
  });
});

describe('PUT /api/tracking/settings', () => {
  const newSettings = {
    ...TRACKING_SETTINGS_DEFAULTS,
    arrivalGeofenceRadiusM: 91,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
    mockUpsert.mockResolvedValue({
      id: 1,
      ...newSettings,
      updatedAt: new Date('2026-07-10T12:00:00Z'),
      updatedBy: 'user-1',
    });
  });

  it('rejects a DRIVER with 403', async () => {
    authAs('DRIVER');
    const response = await PUT(putRequest(newSettings));
    expect(response.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects out-of-bounds values with 400 and field issues', async () => {
    authAs('ADMIN');
    const response = await PUT(
      putRequest({ ...newSettings, arrivalGeofenceRadiusM: 5 }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.issues[0].path).toBe('arrivalGeofenceRadiusM');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed (non-JSON) body with 400', async () => {
    authAs('ADMIN');
    const response = await PUT(
      new NextRequest(URL, { method: 'PUT', body: 'not json' }),
    );
    expect(response.status).toBe(400);
  });

  it('returns 500 (without leaking details) when the DB write fails', async () => {
    authAs('ADMIN');
    mockUpsert.mockRejectedValue(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await PUT(putRequest(newSettings));
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json).toEqual({
      success: false,
      error: 'Failed to update tracking settings',
    });

    errorSpy.mockRestore();
  });

  it('upserts the singleton row with updatedBy, audits, and invalidates the cache', async () => {
    authAs('ADMIN', 'admin-9');
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const response = await PUT(putRequest(newSettings));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.arrivalGeofenceRadiusM).toBe(91);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: { ...newSettings, updatedBy: 'admin-9' },
      create: { id: 1, ...newSettings, updatedBy: 'admin-9' },
    });
    expect(invalidateTrackingSettingsCache).toHaveBeenCalled();

    const auditCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('[AUDIT]'),
    );
    expect(auditCall).toBeDefined();
    expect(String(auditCall![1])).toContain('arrivalGeofenceRadiusM');

    logSpy.mockRestore();
  });
});
