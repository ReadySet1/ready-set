/**
 * Tests for the admin-configurable tracking settings wired into the driver
 * server actions:
 *
 *  - endDriverShift: the imminent-pickup guard window comes from
 *    endShiftPickupGuardMinutes, is bound as a SQL parameter (never
 *    interpolated), and a window of 0 removes the imminent-pickup clause
 *    entirely (in-flight orders still block).
 *  - updateDriverLocation: the rate limiter is configured from
 *    locationUpdateIntervalSeconds before the atomic check.
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

import { endDriverShift, updateDriverLocation } from "../driver-actions";
import { prisma } from "@/utils/prismaDB";
import {
  callerMayActOnDriver,
  getActionCaller,
} from "@/lib/auth/driver-ownership";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { calculateShiftMileage } from "@/services/tracking/mileage";
import { locationRateLimiter } from "@/lib/rate-limiting/location-rate-limiter";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;
const mockMayAct = callerMayActOnDriver as jest.Mock;
const mockGetCaller = getActionCaller as jest.Mock;
const mockGetSettings = getTrackingSettings as jest.Mock;
const mockMileage = calculateShiftMileage as jest.Mock;
const mockConfigure = locationRateLimiter.configure as jest.Mock;
const mockCheckAndRecord = locationRateLimiter.checkAndRecordLimit as jest.Mock;

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
    if (sql.includes("AS n")) {
      return Promise.resolve([{ n: blockingCount }]);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMayAct.mockResolvedValue(true);
  mockGetCaller.mockResolvedValue({ isPrivileged: false });
  mockExecuteRaw.mockResolvedValue(undefined);
  mockMileage.mockResolvedValue({
    totalMiles: 12,
    gpsDistanceMiles: 12,
    mileageSource: "gps",
    warnings: [],
  });
});

describe("endDriverShift imminent-pickup guard window", () => {
  it("binds the admin-configured window as a parameter and blocks when deliveries are due", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      endShiftPickupGuardMinutes: 45,
    });
    mockEndShiftQueries(2n);

    const res = await endDriverShift(SHIFT_ID, endLocation);

    expect(res.success).toBe(false);
    expect(res.activeDeliveries).toBe(2);

    const blockingCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("AS n"),
    );
    expect(blockingCall).toBeDefined();
    const [sql, ...params] = blockingCall!;
    // The window is parameterised via make_interval — never interpolated.
    expect(sql).toContain("make_interval(mins => $2::int)");
    expect(sql).not.toContain("interval '2 hours'");
    expect(sql).not.toContain("45");
    expect(params).toEqual([DRIVER_ID, 45]);

    // Blocked — the shift row must not be closed.
    const shiftClosed = mockExecuteRaw.mock.calls.some(
      ([updateSql]) =>
        typeof updateSql === "string" && updateSql.includes("shift_end"),
    );
    expect(shiftClosed).toBe(false);
  });

  it("omits the imminent-pickup clause entirely when the window is 0", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      endShiftPickupGuardMinutes: 0,
    });
    mockEndShiftQueries(0n);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(true);

    const blockingCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("AS n"),
    );
    const [sql, ...params] = blockingCall!;
    // No imminent-pickup branch and no dangling $2 parameter.
    expect(sql).not.toContain("make_interval");
    expect(sql).not.toContain("$2");
    expect(params).toEqual([DRIVER_ID]);
    // In-flight statuses still block (clause remains).
    expect(sql).toContain("EN_ROUTE_TO_VENDOR");
  });

  it("still blocks in-flight deliveries when the window is 0", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      endShiftPickupGuardMinutes: 0,
    });
    mockEndShiftQueries(1n);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(false);
    expect(res.activeDeliveries).toBe(1);
  });

  it("excludes orders with a PENDING return request from BOTH blocking terms", async () => {
    mockGetSettings.mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
    // 0 blockers: the only assignment has a pending return request.
    mockEndShiftQueries(0n);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(true);

    const blockingCall = mockQueryRaw.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("AS n"),
    );
    expect(blockingCall).toBeDefined();
    const [sql] = blockingCall!;
    // Both terms carry a NOT EXISTS guard against delivery_return_requests:
    // the deliveries mirror keys on order_number, the dispatch join on the
    // catering/on-demand order id.
    const notExists = (sql.match(/NOT EXISTS\s*\(\s*SELECT 1 FROM delivery_return_requests/g) || []).length;
    expect(notExists).toBe(2);
    expect(sql).toContain('rr.order_number = deliveries.order_number');
    expect(sql).toContain('rr.order_id = COALESCE(cr.id, od.id)');
    expect(sql).toContain("rr.status = 'PENDING'");
  });
});

describe("updateDriverLocation rate-limit configuration", () => {
  it("configures the rate limiter from the admin setting before the atomic check", async () => {
    mockGetSettings.mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      locationUpdateIntervalSeconds: 12,
    });
    mockCheckAndRecord.mockReturnValue({ allowed: true });

    const res = await updateDriverLocation(DRIVER_ID, endLocation);

    expect(res.success).toBe(true);
    expect(mockConfigure).toHaveBeenCalledWith(12_000);
    // configure() runs before the atomic check so the new interval applies.
    expect(mockConfigure.mock.invocationCallOrder[0]!).toBeLessThan(
      mockCheckAndRecord.mock.invocationCallOrder[0]!,
    );
  });

  it("rejects the update when the configured interval has not elapsed", async () => {
    mockGetSettings.mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
    mockCheckAndRecord.mockReturnValue({
      allowed: false,
      retryAfter: 3000,
      message: "Rate limit exceeded",
    });

    const res = await updateDriverLocation(DRIVER_ID, endLocation);

    expect(res).toEqual({ success: false, error: "Rate limit exceeded" });
    // No DB write happened.
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});
