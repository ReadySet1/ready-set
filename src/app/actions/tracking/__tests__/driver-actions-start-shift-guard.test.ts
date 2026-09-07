/**
 * startDriverShift guard — one open shift per driver (pilot fix D3).
 *
 *  - If the driver already has an open shift (status active/paused, not
 *    soft-deleted) the action returns it with `resumed: true` and never
 *    inserts a second row.
 *  - With no open shift the INSERT path runs exactly as before.
 *  - If two callers race past the pre-check, the partial unique index
 *    rejects the second INSERT; the action treats that as "someone else
 *    already started it", re-fetches the surviving row and resumes it.
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

import { startDriverShift } from "../driver-actions";
import { prisma } from "@/utils/prismaDB";
import { callerMayActOnDriver } from "@/lib/auth/driver-ownership";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const EXISTING_SHIFT_ID = "22222222-2222-4222-8222-222222222222";
const NEW_SHIFT_ID = "33333333-3333-4333-8333-333333333333";

const startLocation = {
  driverId: DRIVER_ID,
  coordinates: { lat: 37.77, lng: -122.41 },
  accuracy: 10,
  speed: 0,
  heading: 0,
  isMoving: false,
  activityType: "stationary" as const,
  timestamp: new Date(),
} as any;

/** Is this the "does the driver already have an open shift?" lookup? */
const isOpenShiftLookup = (sql: string) =>
  sql.includes("FROM driver_shifts") && sql.includes("'paused'") && sql.includes("deleted_at IS NULL");

const insertCalls = () =>
  mockExecuteRaw.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO driver_shifts"));

beforeEach(() => {
  jest.resetAllMocks();
  (callerMayActOnDriver as jest.Mock).mockResolvedValue(true);
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

describe("startDriverShift — one open shift per driver", () => {
  it("returns the existing open shift with resumed=true and does not insert", async () => {
    mockQueryRaw.mockImplementation((sql: string) => {
      if (isOpenShiftLookup(sql)) return Promise.resolve([{ id: EXISTING_SHIFT_ID }]);
      return Promise.resolve([]);
    });

    const result = await startDriverShift(DRIVER_ID, startLocation);

    expect(result).toEqual({ success: true, shiftId: EXISTING_SHIFT_ID, resumed: true });
    expect(insertCalls()).toHaveLength(0);
    // The lookup must ignore soft-deleted rows and cover paused shifts too.
    const [lookupSql] = mockQueryRaw.mock.calls.find(([sql]) => isOpenShiftLookup(String(sql)))!;
    expect(lookupSql).toMatch(/status IN \('active',\s*'paused'\)/);
  });

  it("inserts a new shift when the driver has no open shift", async () => {
    mockQueryRaw.mockImplementation((sql: string) => {
      if (isOpenShiftLookup(sql)) return Promise.resolve([]);
      // Post-insert id fetch
      return Promise.resolve([{ id: NEW_SHIFT_ID }]);
    });
    mockExecuteRaw.mockResolvedValue(1);

    const result = await startDriverShift(DRIVER_ID, startLocation);

    expect(result.success).toBe(true);
    expect(result.shiftId).toBe(NEW_SHIFT_ID);
    expect(result.resumed).toBe(false);
    expect(insertCalls()).toHaveLength(1);
    // Driver row still gets flipped on duty.
    expect(mockExecuteRaw).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE drivers"),
      DRIVER_ID,
      startLocation.coordinates.lng,
      startLocation.coordinates.lat,
    );
  });

  it.each([
    [
      "Prisma raw-query error carrying the Postgres 23505 code",
      Object.assign(new Error("Raw query failed. Code: `23505`."), {
        code: "P2010",
        meta: { code: "23505", message: "duplicate key value violates unique constraint" },
      }),
    ],
    [
      "Prisma P2002 unique-constraint error",
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    ],
    [
      "plain driver error mentioning the unique index",
      new Error('duplicate key value violates unique constraint "driver_shifts_one_open_per_driver_idx"'),
    ],
  ])("resumes the winner's shift when the INSERT loses a race (%s)", async (_label, uniqueError) => {
    // Pre-check sees nothing; the concurrent caller commits in between; the
    // DB guard rejects our INSERT; the re-fetch finds the winner's row.
    let lookups = 0;
    mockQueryRaw.mockImplementation((sql: string) => {
      if (isOpenShiftLookup(sql)) {
        lookups += 1;
        return Promise.resolve(lookups === 1 ? [] : [{ id: EXISTING_SHIFT_ID }]);
      }
      return Promise.resolve([]);
    });
    mockExecuteRaw.mockImplementation((sql: string) => {
      if (String(sql).includes("INSERT INTO driver_shifts")) return Promise.reject(uniqueError);
      return Promise.resolve(1);
    });

    const result = await startDriverShift(DRIVER_ID, startLocation);

    expect(result).toEqual({ success: true, shiftId: EXISTING_SHIFT_ID, resumed: true });
    expect(insertCalls()).toHaveLength(1);
    expect(lookups).toBe(2);
    // The losing caller must not touch the driver row; the winner already did.
    expect(mockExecuteRaw).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE drivers"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("still surfaces non-unique database errors", async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRaw.mockRejectedValue(new Error("connection reset"));

    const result = await startDriverShift(DRIVER_ID, startLocation);

    expect(result).toEqual({ success: false, error: "connection reset" });
  });
});
