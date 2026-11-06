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
import { calculateShiftMileage, computeAnchorDistanceMeters } from "../mileage";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";
import {
  MILEAGE_CONFIG,
  METERS_TO_MILES,
  milesToMeters,
  mphToMs,
} from "@/config/mileage-config";
// Real rs-dev GPS trails (2026-10-14 field test), translated to a synthetic
// local frame: n/e are meters north/east of a fixed origin, t is seconds since
// shift start. Distances, timestamps, accuracy and speed are preserved; the
// real coordinates and driver ids are not. `phantom` marks the fixes from the
// second, stale stream (constant battery, server-stamped time).
import phantomPingShifts from "./fixtures/phantom-ping-shifts.json";

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

function milesFromMeters(meters: number): number {
  return meters * METERS_TO_MILES;
}

interface FixturePoint {
  t: number;
  n: number;
  e: number;
  phantom: boolean;
}

type FixtureShift = keyof typeof phantomPingShifts;

/** Fixture trail as odometer points, optionally without the phantom stream. */
function fixtureTrail(
  shift: FixtureShift,
  { withoutPhantoms = false }: { withoutPhantoms?: boolean } = {},
): SyntheticPoint[] {
  const points: FixturePoint[] = phantomPingShifts[shift].points;
  return points
    .filter((p) => !(withoutPhantoms && p.phantom))
    .map((p) => point(p.n, p.e, p.t));
}

/** Odometer miles at the production defaults (95 mph cap, 3.1 mi segment). */
function odometerMiles(points: SyntheticPoint[]): number {
  return milesFromMeters(
    computeAnchorDistanceMeters(
      points,
      mphToMs(TRACKING_SETTINGS_DEFAULTS.mileageMaxSpeedMph),
      milesToMeters(MILEAGE_CONFIG.MAX_SEGMENT_DISTANCE_MILES),
    ),
  );
}

/**
 * Motorcycle-in-the-city route: east at `speedMs` with a 5s fix cadence,
 * optionally with a silent gap (locked screen) during which the rider keeps
 * moving at the same speed. Returns the trail and its true length in meters.
 */
function cityRoute({
  speedMs,
  fixes,
  gapAfterFix,
  gapSeconds = 0,
}: {
  speedMs: number;
  fixes: number;
  gapAfterFix?: number;
  gapSeconds?: number;
}): { points: SyntheticPoint[]; trueMeters: number } {
  const points: SyntheticPoint[] = [];
  let t = 0;
  for (let i = 0; i < fixes; i++) {
    points.push(point(0, t * speedMs, t));
    t += i === gapAfterFix ? gapSeconds : 5;
  }
  const last = points[points.length - 1]!;
  const trueMeters = ((last.recorded_at.getTime() - T0) / 1000) * speedMs;
  return { points, trueMeters };
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

  it("drops hops exceeding the admin max speed as GPS glitches", async () => {
    // Two consecutive 400m hops in 10s each (40 m/s), never returning — so
    // only the admin speed cap decides whether they count, not the
    // out-and-back spike filter.
    const fastTrail: SyntheticPoint[] = [
      point(0, 0, 0),
      point(400, 0, 10),
      point(800, 0, 20),
    ];

    // 60 mph ≈ 26.8 m/s: the 40 m/s hops are glitches and must not count.
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageMaxSpeedMph: 60,
    });
    mockMileageQueries(fastTrail);
    const capped = await calculateShiftMileage(SHIFT_ID);
    expect(capped.totalMiles).toBe(0);

    // 95 mph ≈ 42.5 m/s: the same hops are admissible and count (800m).
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      mileageMaxSpeedMph: 95,
    });
    mockMileageQueries(fastTrail);
    const allowed = await calculateShiftMileage(SHIFT_ID);
    expect(allowed.totalMiles).toBeCloseTo(milesFromMeters(800), 2);
  });
});

// ---------------------------------------------------------------------------
// Teleport-and-return outliers (phantom pings)
// ---------------------------------------------------------------------------

describe("computeAnchorDistanceMeters teleport-and-return outliers", () => {
  it("reproduces the field data: the stationary shift has ~465m phantom spikes", () => {
    // Guard on the fixture itself so the tests below stay meaningful.
    const trail = phantomPingShifts.stationaryWithPhantoms.points;
    const origin = trail.find((p) => !p.phantom)!;
    const spikes = trail.filter(
      (p) => p.phantom && Math.hypot(p.n - origin.n, p.e - origin.e) > 400,
    );
    expect(spikes.length).toBeGreaterThanOrEqual(5);
  });

  it("counts ~0 mi for the stationary shift polluted by phantom spikes (stored 2.31 mi)", () => {
    expect(odometerMiles(fixtureTrail("stationaryWithPhantoms"))).toBeLessThan(0.02);
  });

  it("counts ~0 mi for the stationary shift with a single phantom fix (stored 0.29 mi)", () => {
    expect(odometerMiles(fixtureTrail("stationaryWithOnePhantom"))).toBeLessThan(0.02);
  });

  it("keeps a real drive's distance when a phantom stream is interleaved", () => {
    const clean = odometerMiles(
      fixtureTrail("realDriveWithPhantoms", { withoutPhantoms: true }),
    );
    const polluted = odometerMiles(fixtureTrail("realDriveWithPhantoms"));
    // The real pickup → dropoff route measures ~0.56 mi. The old odometer
    // billed 0.92 mi for this shift: the long phantom hops back to the pickup
    // must go. Two phantoms land within ~30m of the driver while he is still
    // at the pickup, at walking-pace speeds — indistinguishable from real
    // movement without device metadata — so a small residual remains.
    expect(clean).toBeGreaterThan(0.5);
    expect(polluted).toBeGreaterThanOrEqual(clean);
    expect(polluted - clean).toBeLessThan(0.1);
  });

  it("drops a fast spike out and back during real driving", () => {
    const { points, trueMeters } = cityRoute({ speedMs: 12, fixes: 60 });
    const spiked = [...points];
    // Fix 30 teleports 465m sideways for one ping, then the trail resumes.
    const at = spiked[30]!;
    spiked[30] = {
      ...at,
      latitude: at.latitude + 465 / M_PER_DEG_LAT,
    };
    expect(odometerMiles(spiked)).toBeCloseTo(milesFromMeters(trueMeters), 1);
    expect(odometerMiles(spiked)).toBeLessThan(odometerMiles(points) + 0.01);
  });

  it("drops a slow-in / fast-out spike after a long stationary stretch", () => {
    // The original bug: still for two minutes, then a phantom 465m away (slow
    // vs the anchor's old timestamp), then 5s later back home (impossible).
    const points: SyntheticPoint[] = [];
    for (let i = 0; i <= 24; i++) points.push(point(0, 0, i * 5));
    points.push(point(0, 0, 240)); // locked screen: no fixes for 2 minutes
    points.push(point(465, 0, 360)); // phantom
    points.push(point(2, 1, 365)); // back home
    points.push(point(465, 2, 367)); // phantom again, fast in
    points.push(point(1, 0, 371)); // and back
    for (let i = 1; i <= 10; i++) points.push(point(0, 0, 371 + i * 5));
    expect(odometerMiles(points)).toBeLessThan(0.01);
  });

  it("ignores a phantom that is the very first fix of the trail", () => {
    const points: SyntheticPoint[] = [point(465, 0, 0)];
    for (let i = 1; i <= 30; i++) points.push(point(0, 0, i * 5));
    expect(odometerMiles(points)).toBeLessThan(0.01);
  });

  it("ignores a phantom that is the very last fix of the trail", () => {
    const points: SyntheticPoint[] = [];
    for (let i = 0; i < 30; i++) points.push(point(0, 0, i * 5));
    points.push(point(465, 0, 152));
    expect(odometerMiles(points)).toBeLessThan(0.01);
  });

  it("drops a two-fix phantom burst", () => {
    const points: SyntheticPoint[] = [];
    for (let i = 0; i < 20; i++) points.push(point(0, 0, i * 5));
    points.push(point(465, 0, 98), point(466, 3, 102));
    for (let i = 21; i < 40; i++) points.push(point(0, 0, i * 5));
    expect(odometerMiles(points)).toBeLessThan(0.01);
  });

  it("counts a motorcycle city route at a 5s cadence", () => {
    const { points, trueMeters } = cityRoute({ speedMs: 11, fixes: 120 });
    expect(odometerMiles(points)).toBeCloseTo(milesFromMeters(trueMeters), 2);
  });

  it("counts the real travel across a locked-screen gap", () => {
    // 90s without fixes while riding 13 m/s: the 1,170m jump is real and slow
    // enough (13 m/s) to be plausible, so it must be counted in full.
    const { points, trueMeters } = cityRoute({
      speedMs: 13,
      fixes: 60,
      gapAfterFix: 25,
      gapSeconds: 90,
    });
    expect(odometerMiles(points)).toBeCloseTo(milesFromMeters(trueMeters), 2);
  });

  it("counts a 2-minute gap that ends somewhere new and stays there", () => {
    // Parked, locked screen, rode 1.4 km in two minutes, parked again.
    const points: SyntheticPoint[] = [];
    for (let i = 0; i < 12; i++) points.push(point(0, 0, i * 5));
    for (let i = 0; i < 12; i++) points.push(point(1400, 0, 55 + 120 + i * 5));
    expect(odometerMiles(points)).toBeCloseTo(milesFromMeters(1400), 2);
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

// ---------------------------------------------------------------------------
// Round trips (end shift waits on this; the DB is ~150 ms from the app server)
// ---------------------------------------------------------------------------

describe("calculateShiftMileage round trips", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("reads the shift window and the settings concurrently", async () => {
    let releaseShift!: (v: unknown) => void;
    mockMileageQueries([]);
    const base = mockQueryRaw.getMockImplementation()!;
    mockQueryRaw.mockImplementation((sql: string) =>
      sql.includes("FROM driver_shifts")
        ? new Promise((r) => {
            releaseShift = r;
          })
        : base(sql),
    );

    const pending = calculateShiftMileage(SHIFT_ID);
    await flush();
    // Settings are requested while the shift row is still in flight.
    expect(mockGetSettings).toHaveBeenCalledTimes(1);

    releaseShift(await base("FROM driver_shifts"));
    await pending;
  });

  it("runs the GPS diagnostic and trail queries concurrently", async () => {
    let releaseDiagnostic!: (v: unknown) => void;
    const points = straightPathPoints(1, 10);
    mockMileageQueries(points);
    const base = mockQueryRaw.getMockImplementation()!;
    mockQueryRaw.mockImplementation((sql: string) =>
      sql.includes("total_points")
        ? new Promise((r) => {
            releaseDiagnostic = r;
          })
        : base(sql),
    );

    const pending = calculateShiftMileage(SHIFT_ID);
    await flush();
    const trailQueries = mockQueryRaw.mock.calls.filter(([sql]) =>
      String(sql).includes("ORDER BY recorded_at"),
    );
    expect(trailQueries).toHaveLength(1);

    releaseDiagnostic([{ total_points: points.length, filtered_points: 0 }]);
    const result = await pending;
    expect(result.totalMiles).toBeCloseTo(1, 1);
  });
});
