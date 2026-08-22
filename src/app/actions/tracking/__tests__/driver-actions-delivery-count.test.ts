/**
 * Tests for the delivery_count recompute in endDriverShift.
 *
 * The AFTER trigger on `deliveries` only fires on delivery writes, so shifts
 * whose deliveries were mirrored before shift linkage existed (or with the
 * uppercase status casing the orders PATCH writes, e.g. 'COMPLETED') would
 * close with a stale count. Ending a shift must recompute delivery_count
 * directly from the deliveries table, case-insensitively, counting both
 * 'delivered' and 'completed'.
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
  locationRateLimiter: {
    configure: jest.fn(),
    checkAndRecordLimit: jest.fn(),
  },
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
jest.mock("@/lib/cache/driver-metadata-cache", () => ({
  driverMetadataCache: { get: jest.fn(), set: jest.fn() },
}));
jest.mock("@/lib/logging/realtime-logger", () => ({
  realtimeLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    rateLimit: jest.fn(),
  },
}));
jest.mock("@/lib/realtime/stale-detection", () => ({
  staleLocationDetector: { recordLocation: jest.fn(), setStaleThreshold: jest.fn() },
}));

import { endDriverShift } from "../driver-actions";
import { prisma } from "@/utils/prismaDB";
import {
  callerMayActOnDriver,
  getActionCaller,
} from "@/lib/auth/driver-ownership";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { calculateShiftMileage } from "@/services/tracking/mileage";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;
const mockMayAct = callerMayActOnDriver as jest.Mock;
const mockGetCaller = getActionCaller as jest.Mock;
const mockGetSettings = getTrackingSettings as jest.Mock;
const mockMileage = calculateShiftMileage as jest.Mock;

const SHIFT_ID = "22222222-2222-4222-8222-222222222222";
const DRIVER_ID = "11111111-1111-4111-8111-111111111111";

const endLocation = {
  driverId: DRIVER_ID,
  coordinates: { lat: 37.77, lng: -122.41 },
  accuracy: 10,
  speed: 0,
  heading: 0,
  isMoving: false,
  activityType: "stationary" as const,
  timestamp: new Date(),
} as any;

/** Route the two $queryRawUnsafe calls endDriverShift makes. */
function mockEndShiftQueries(blockingCount: bigint) {
  mockQueryRaw.mockImplementation((sql: string) => {
    if (sql.includes("FROM driver_shifts")) {
      return Promise.resolve([{ driver_id: DRIVER_ID, status: "active" }]);
    }
    if (sql.includes("end-shift-blockers")) {
      return Promise.resolve(
        Array.from({ length: Number(blockingCount) }, (_, i) => ({
          order_number: `ORD-${i + 1}`,
          reason: "ACTIVE_DELIVERY",
        })),
      );
    }
    return Promise.resolve([]);
  });
}

const findRecomputeCall = () =>
  mockExecuteRaw.mock.calls.find(
    ([sql]) => typeof sql === "string" && sql.includes("delivery_count"),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockMayAct.mockResolvedValue(true);
  mockGetCaller.mockResolvedValue({ isPrivileged: false });
  mockExecuteRaw.mockResolvedValue(undefined);
  mockGetSettings.mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
  mockMileage.mockResolvedValue({
    totalMiles: 12,
    gpsDistanceMiles: 12,
    mileageSource: "gps",
    warnings: [],
  });
});

describe("endDriverShift delivery_count recompute", () => {
  it("recomputes delivery_count from the deliveries table when closing", async () => {
    mockEndShiftQueries(0n);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(true);

    const recompute = findRecomputeCall();
    expect(recompute).toBeDefined();
    const [sql, ...params] = recompute!;
    // Case-insensitive, counts both terminal spellings, honors soft delete,
    // and scopes to this shift via a bound parameter.
    expect(sql).toContain("LOWER(status) IN ('delivered','completed')");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("shift_id = $1::uuid");
    expect(params).toEqual([SHIFT_ID]);
  });

  it("does not recompute when the end-shift guard blocks", async () => {
    mockEndShiftQueries(2n);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(false);

    expect(findRecomputeCall()).toBeUndefined();
  });

  it("does not recompute when the shift is not active", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(false);

    expect(findRecomputeCall()).toBeUndefined();
  });
});
