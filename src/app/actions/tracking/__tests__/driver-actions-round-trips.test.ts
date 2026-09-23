/**
 * Round-trip budget for the driver shift actions (2026-09-22 field feedback:
 * every driver action got slow once the app moved to a VPS ~150 ms from the
 * database). Independent lookups must overlap, the caller must be resolved
 * once per action, and writes that always travel together go in one
 * statement. Authorization semantics are covered by the other suites; this
 * one pins the call shape.
 */

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/auth-middleware", () => ({ withAuth: jest.fn() }));
jest.mock("@/lib/auth/driver-ownership", () => ({
  authorizeDriverAction: jest.fn(),
  callerMayActOnDriver: jest.fn(),
  getActionCaller: jest.fn(),
}));
jest.mock("@/services/tracking/tracking-settings", () => ({
  getTrackingSettings: jest.fn(),
}));
jest.mock("@/services/tracking/mileage", () => ({
  calculateShiftMileage: jest.fn(),
  calculateShiftMileageWithBreakdown: jest.fn(),
  calculateShiftMileageWithValidation: jest.fn(),
}));
jest.mock("@/lib/rate-limiting/location-rate-limiter", () => ({
  locationRateLimiter: { configure: jest.fn(), checkAndRecordLimit: jest.fn() },
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
jest.mock("@/lib/cache/driver-metadata-cache", () => ({
  driverMetadataCache: { get: jest.fn(), set: jest.fn() },
}));
jest.mock("@/lib/logging/realtime-logger", () => ({
  realtimeLogger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), rateLimit: jest.fn() },
}));
jest.mock("@/lib/realtime/stale-detection", () => ({
  staleLocationDetector: { recordLocation: jest.fn(), setStaleThreshold: jest.fn() },
}));

import {
  endDriverShift,
  endShiftBreak,
  startDriverShift,
  startShiftBreak,
} from "../driver-actions";
import { prisma } from "@/utils/prismaDB";
import {
  authorizeDriverAction,
  callerMayActOnDriver,
  getActionCaller,
} from "@/lib/auth/driver-ownership";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { calculateShiftMileage } from "@/services/tracking/mileage";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;
const mockAuthorize = authorizeDriverAction as jest.Mock;
const mockMayAct = callerMayActOnDriver as jest.Mock;
const mockGetCaller = getActionCaller as jest.Mock;
const mockMileage = calculateShiftMileage as jest.Mock;

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT_ID = "22222222-2222-4222-8222-222222222222";

const location = {
  driverId: DRIVER_ID,
  coordinates: { lat: 37.77, lng: -122.41 },
  accuracy: 10,
  speed: 0,
  heading: 0,
  isMoving: false,
  activityType: "stationary" as const,
  timestamp: new Date(),
} as any;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const sqlCalls = (mock: jest.Mock, fragment: string) =>
  mock.mock.calls.filter(([sql]) => String(sql).includes(fragment));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockAuthorize.mockResolvedValue({
    allowed: true,
    caller: { userId: "u1", isPrivileged: false },
  });
  mockMayAct.mockResolvedValue(true);
  mockGetCaller.mockResolvedValue({ userId: "u1", isPrivileged: false });
  (getTrackingSettings as jest.Mock).mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
  mockExecuteRaw.mockResolvedValue(1);
  mockMileage.mockResolvedValue({
    totalMiles: 3,
    gpsDistanceMiles: 3,
    mileageSource: "gps",
    warnings: [],
  });
});

describe("startDriverShift round trips", () => {
  it("looks up the open shift while authorization is still in flight", async () => {
    const auth = deferred<boolean>();
    mockMayAct.mockReturnValue(auth.promise);
    mockQueryRaw.mockResolvedValue([]);

    const pending = startDriverShift(DRIVER_ID, location);
    await flush();
    expect(sqlCalls(mockQueryRaw, "'paused'")).toHaveLength(1);

    auth.resolve(false);
    await expect(pending).resolves.toEqual({ success: false, error: "Access denied" });
    // Denied: nothing is written.
    expect(sqlCalls(mockQueryRaw, "INSERT")).toHaveLength(0);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("inserts the shift and flips the driver row in one statement", async () => {
    mockQueryRaw.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes("INSERT INTO driver_shifts") ? [{ id: SHIFT_ID }] : []),
    );

    const result = await startDriverShift(DRIVER_ID, location);

    expect(result).toEqual({ success: true, shiftId: SHIFT_ID, resumed: false });
    const [insert] = sqlCalls(mockQueryRaw, "INSERT INTO driver_shifts");
    expect(insert).toBeDefined();
    const sql = String(insert![0]);
    expect(sql).toContain("RETURNING id");
    expect(sql).toContain("UPDATE drivers");
    expect(sql).toMatch(/current_shift_id = \(SELECT id FROM new_shift\)/);
    expect(insert!.slice(1)).toEqual([
      DRIVER_ID,
      location.coordinates.lng,
      location.coordinates.lat,
      null,
    ]);
    // Open-shift lookup + the combined write. No separate UPDATE / re-select.
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe("endDriverShift round trips", () => {
  const shiftRow = [{ driver_id: DRIVER_ID, status: "active" }];

  it("authenticates while the shift row is being fetched, and only once", async () => {
    const shift = deferred<unknown[]>();
    mockQueryRaw.mockImplementation((sql: string) =>
      sql.includes("FROM driver_shifts") && !sql.includes("end-shift-blockers")
        ? shift.promise
        : Promise.resolve([]),
    );

    const pending = endDriverShift(SHIFT_ID, location);
    await flush();
    expect(mockAuthorize).toHaveBeenCalledTimes(1);

    shift.resolve(shiftRow);
    await expect(pending).resolves.toEqual({ success: true });
    // The shift's driver id is what gets authorized.
    await expect(mockAuthorize.mock.calls[0]![0]).resolves.toBe(DRIVER_ID);
    // No second identity / role lookup for the force check.
    expect(mockGetCaller).not.toHaveBeenCalled();
    expect(mockMayAct).not.toHaveBeenCalled();
  });

  it("still denies a caller who may not act on the shift's driver", async () => {
    mockAuthorize.mockResolvedValue({ allowed: false, caller: null });
    mockQueryRaw.mockResolvedValue(shiftRow);

    await expect(endDriverShift(SHIFT_ID, location)).resolves.toEqual({
      success: false,
      error: "Access denied",
    });
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it("lets a privileged caller force past the guard from the same authorization", async () => {
    mockAuthorize.mockResolvedValue({
      allowed: true,
      caller: { userId: "admin", isPrivileged: true },
    });
    mockQueryRaw.mockResolvedValue(shiftRow);

    await expect(
      endDriverShift(SHIFT_ID, location, undefined, { force: true }),
    ).resolves.toEqual({ success: true });
    expect(sqlCalls(mockQueryRaw, "end-shift-blockers")).toHaveLength(0);
  });

  it("recomputes delivery_count and closes the shift in one UPDATE", async () => {
    mockQueryRaw.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes("end-shift-blockers") ? [] : shiftRow),
    );

    await endDriverShift(SHIFT_ID, location);

    const shiftUpdates = sqlCalls(mockExecuteRaw, "UPDATE driver_shifts").filter(
      ([sql]) => !String(sql).includes("total_distance"),
    );
    expect(shiftUpdates).toHaveLength(1);
    const sql = String(shiftUpdates[0]![0]);
    expect(sql).toContain("delivery_count");
    expect(sql).toContain("status = 'completed'");
  });

  it("releases the driver row without waiting for the mileage calculation", async () => {
    const mileage = deferred<unknown>();
    mockMileage.mockReturnValue(mileage.promise);
    mockQueryRaw.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes("end-shift-blockers") ? [] : shiftRow),
    );

    const pending = endDriverShift(SHIFT_ID, location);
    await flush();
    expect(sqlCalls(mockExecuteRaw, "UPDATE drivers")).toHaveLength(1);

    mileage.resolve({ totalMiles: 3, gpsDistanceMiles: 3, mileageSource: "gps", warnings: [] });
    await expect(pending).resolves.toEqual({ success: true });
  });
});

describe("break round trips", () => {
  it.each([
    ["startShiftBreak", () => startShiftBreak(SHIFT_ID)],
    ["endShiftBreak", () => endShiftBreak(SHIFT_ID)],
  ])("%s authenticates while the shift row is being fetched", async (_name, run) => {
    const shift = deferred<unknown[]>();
    mockQueryRaw.mockReturnValue(shift.promise);

    const pending = run();
    await flush();
    expect(mockAuthorize).toHaveBeenCalledTimes(1);

    shift.resolve([{ id: SHIFT_ID, driver_id: DRIVER_ID, status: "paused" }]);
    await expect(pending).resolves.toMatchObject({ success: true });
    await expect(mockAuthorize.mock.calls[0]![0]).resolves.toBe(DRIVER_ID);
    expect(mockMayAct).not.toHaveBeenCalled();
  });

  it("denies a break for a shift the caller may not act on", async () => {
    mockAuthorize.mockResolvedValue({ allowed: false, caller: null });
    mockQueryRaw.mockResolvedValue([{ id: SHIFT_ID, driver_id: DRIVER_ID }]);

    await expect(startShiftBreak(SHIFT_ID)).resolves.toEqual({
      success: false,
      error: "Access denied",
    });
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
