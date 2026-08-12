/**
 * Tests for shift mileage calculation.
 *
 * Covers two areas:
 * 1. The anchor-based odometer: distance accumulates only when displacement
 *    from the current anchor point exceeds MIN_DISPLACEMENT_M, so stationary
 *    GPS jitter sums to ~zero while genuine movement is preserved.
 * 2. The admin-configurable settings wired into the calculation: the GPS
 *    accuracy filter, the max-speed glitch filter, and the
 *    max-reasonable-shift-miles warning threshold all come from
 *    getTrackingSettings() (fail-open, cache-backed) instead of MILEAGE_CONFIG.
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
import { MILEAGE_CONFIG, milesToMeters } from "@/config/mileage-config";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;
const mockGetSettings = getTrackingSettings as jest.Mock;

const SHIFT_ID = "22222222-2222-4222-8222-222222222222";
const DRIVER_ID = "11111111-1111-4111-8111-111111111111";

// ---------------------------------------------------------------------------
// Synthetic GPS point helpers
// ---------------------------------------------------------------------------

interface SyntheticPoint {
  latitude: number;
  longitude: number;
  recorded_at: Date;
}

const BASE_LAT = 37.7749;
const BASE_LNG = -122.4194;
/** Meters per degree of latitude on a 6371km sphere (π/180 × 6,371,000). */
const M_PER_DEG_LAT = 111194.9266;
const T0 = new Date("2026-07-10T08:00:00Z").getTime();

/** Build a point offset north/east (in meters) from the base coordinate. */
function point(northM: number, eastM: number, atSeconds: number): SyntheticPoint {
  return {
    latitude: BASE_LAT + northM / M_PER_DEG_LAT,
    longitude:
      BASE_LNG + eastM / (M_PER_DEG_LAT * Math.cos((BASE_LAT * Math.PI) / 180)),
    recorded_at: new Date(T0 + atSeconds * 1000),
  };
}

/** Deterministic PRNG (mulberry32) so jitter tests are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic standard-normal sampler (Box–Muller over mulberry32). */
function makeGaussian(seed: number): () => number {
  const rng = mulberry32(seed);
  return () => {
    const u = Math.max(rng(), 1e-12);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/** Straight drive north totalling exactly `totalMiles`, one fix per minute. */
function straightPathPoints(totalMiles: number, steps: number): SyntheticPoint[] {
  const stepM = milesToMeters(totalMiles) / steps;
  const points: SyntheticPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push(point(i * stepM, 0, i * 60));
  }
  return points;
}

/** Route the three $queryRawUnsafe calls calculateShiftMileage makes. */
function mockMileageQueries(points: SyntheticPoint[]) {
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
      return Promise.resolve([
        { total_points: points.length, filtered_points: 0 },
      ]);
    }
    if (sql.includes("latitude")) {
      return Promise.resolve(points);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExecuteRaw.mockResolvedValue(undefined);
  mockGetSettings.mockResolvedValue({ ...TRACKING_SETTINGS_DEFAULTS });
});

// ---------------------------------------------------------------------------
// Anchor-based odometer behavior
// ---------------------------------------------------------------------------

describe("calculateShiftMileage anchor-based odometer", () => {
  it("suppresses stationary GPS jitter to near-zero mileage", async () => {
    // ~100 fixes over 20 minutes, Gaussian jitter scattered within ±15m of a
    // single coordinate — the field failure mode (walking-pace shift where a
    // raw pair-sum accumulated ~1 mile of pure noise).
    const gauss = makeGaussian(42);
    const points: SyntheticPoint[] = [];
    for (let i = 0; i < 100; i++) {
      points.push(
        point(clamp(gauss() * 4, 15), clamp(gauss() * 4, 15), i * 12),
      );
    }
    mockMileageQueries(points);

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.totalMiles).toBeLessThan(0.05);
  });

  it("tracks a straight walk with lateral jitter to within ~15% of truth", async () => {
    // 6m of true northward progress per 5s fix with ±10m lateral noise,
    // 1602m (~1.0 mi) of true displacement in total.
    const gauss = makeGaussian(7);
    const points: SyntheticPoint[] = [];
    for (let i = 0; i <= 267; i++) {
      points.push(point(i * 6, clamp(gauss() * 3, 10), i * 5));
    }
    mockMileageQueries(points);

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.totalMiles).toBeGreaterThan(0.85);
    expect(result.totalMiles).toBeLessThan(1.15);
  });

  it("never accumulates displacement steps below MIN_DISPLACEMENT_M", async () => {
    // Oscillate between the anchor and a point just under the threshold; the
    // anchor must never advance, so total distance stays exactly zero.
    const justUnder = MILEAGE_CONFIG.MIN_DISPLACEMENT_M - 1;
    const points: SyntheticPoint[] = [];
    for (let i = 0; i < 50; i++) {
      points.push(point(i % 2 === 0 ? 0 : justUnder, 0, i * 5));
    }
    mockMileageQueries(points);

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.totalMiles).toBe(0);
  });

  it("defaults MIN_DISPLACEMENT_M to 15 meters", () => {
    expect(MILEAGE_CONFIG.MIN_DISPLACEMENT_M).toBe(15);
  });

  it("drops anchor hops exceeding the admin max speed as GPS glitches", async () => {
    // A single stray fix teleporting 400m in 10s (40 m/s), then back.
    const glitchTrail: SyntheticPoint[] = [
      point(0, 0, 0),
      point(400, 0, 10),
      point(0, 0, 15),
    ];

    // 60 mph ≈ 26.8 m/s: the 40 m/s hop is a glitch and must not count.
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageMaxSpeedMph: 60,
    });
    mockMileageQueries(glitchTrail);
    const capped = await calculateShiftMileage(SHIFT_ID);
    expect(capped.totalMiles).toBe(0);

    // 95 mph ≈ 42.5 m/s: the same hop is admissible and counts.
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageMaxSpeedMph: 95,
    });
    mockMileageQueries(glitchTrail);
    const allowed = await calculateShiftMileage(SHIFT_ID);
    expect(allowed.totalMiles).toBeGreaterThan(0.2);
  });
});

// ---------------------------------------------------------------------------
// Admin tracking settings plumbing
// ---------------------------------------------------------------------------

describe("calculateShiftMileage with admin tracking settings", () => {
  it("passes the admin accuracy threshold into the GPS queries", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageGpsAccuracyThresholdM: 42,
    });
    mockMileageQueries(straightPathPoints(25, 100));

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.totalMiles).toBeCloseTo(25, 2);
    expect(result.warnings).toEqual([]);

    // Diagnostic query: $4 is the accuracy threshold.
    const diagnosticCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("total_points"),
    );
    expect(diagnosticCall![4]).toBe(42);

    // Points query: $4 is the accuracy threshold too.
    const pointsCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("latitude"),
    );
    expect(pointsCall![4]).toBe(42);
  });

  it("warns via the admin max-reasonable-shift-miles threshold, not the hardcoded one", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      maxReasonableShiftMiles: 100,
    });
    // 150 mi is fine under the historical 310 default but over the admin's 100.
    mockMileageQueries(straightPathPoints(150, 240));

    const result = await calculateShiftMileage(SHIFT_ID);

    expect(result.totalMiles).toBeCloseTo(150, 2);
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
    mockMileageQueries(straightPathPoints(400, 640));

    const result = await calculateShiftMileage(SHIFT_ID);
    expect(result.warnings).toEqual([]);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
