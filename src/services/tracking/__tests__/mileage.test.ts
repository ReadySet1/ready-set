/**
 * Tests for the admin-configurable settings wired into shift mileage
 * calculation: the GPS accuracy filter, the max-speed glitch filter, and the
 * max-reasonable-shift-miles warning threshold all come from
 * getTrackingSettings() (fail-open, cache-backed) instead of MILEAGE_CONFIG.
 */

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  },
}));
jest.mock("@sentry/nextjs", () => ({
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock("@/services/tracking/tracking-settings", () => ({
  getTrackingSettings: jest.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/utils/prismaDB";
import { calculateShiftMileage } from "../mileage";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;
const mockGetSettings = getTrackingSettings as jest.Mock;

const SHIFT_ID = "22222222-2222-4222-8222-222222222222";
const DRIVER_ID = "11111111-1111-4111-8111-111111111111";

/** Route the three $queryRawUnsafe calls calculateShiftMileage makes. */
function mockMileageQueries(totalMiles: number) {
  mockQueryRaw.mockImplementation((sql: string) => {
    if (sql.includes("FROM driver_shifts")) {
      return Promise.resolve([
        {
          id: SHIFT_ID,
          driver_id: DRIVER_ID,
          start_time: new Date("2026-07-10T08:00:00Z"),
          end_time: new Date("2026-07-10T16:00:00Z"),
        },
      ]);
    }
    if (sql.includes("total_points")) {
      return Promise.resolve([{ total_points: 200, filtered_points: 0 }]);
    }
    if (sql.includes("total_miles")) {
      return Promise.resolve([{ total_miles: totalMiles }]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
});

describe("calculateShiftMileage with admin tracking settings", () => {
  it("passes the admin accuracy threshold and max speed (mph → m/s) into the GPS queries", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageGpsAccuracyThresholdM: 42,
      mileageMaxSpeedMph: 60,
    });
    mockMileageQueries(25);

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.totalMiles).toBe(25);
    expect(result.warnings).toEqual([]);

    // Diagnostic query: $4 is the accuracy threshold.
    const diagnosticCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("total_points"),
    );
    expect(diagnosticCall![4]).toBe(42);

    // Distance query: $4 accuracy, $9 max speed in m/s (60 mph ≈ 26.82 m/s).
    const distanceCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("total_miles"),
    );
    expect(distanceCall![4]).toBe(42);
    expect(distanceCall![9]).toBeCloseTo(60 / 2.23694, 5);
  });

  it("warns via the admin max-reasonable-shift-miles threshold, not the hardcoded one", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      maxReasonableShiftMiles: 100,
    });
    // 150 mi is fine under the historical 310 default but over the admin's 100.
    mockMileageQueries(150);

    const result = await calculateShiftMileage(SHIFT_ID);

    expect(result.totalMiles).toBe(150);
    expect(result.warnings).toEqual([
      expect.stringContaining("exceeds 100 mile threshold"),
    ]);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "Unusually high mileage for shift",
      expect.objectContaining({
        extra: expect.objectContaining({ threshold: 100 }),
      }),
    );
  });

  it("does not warn when the total is under the admin threshold", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      maxReasonableShiftMiles: 500,
    });
    // 400 mi would trip the historical 310 default, but the admin raised it.
    mockMileageQueries(400);

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.warnings).toEqual([]);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
