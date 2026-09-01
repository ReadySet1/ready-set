/**
 * endDriverShift guard — cancelled orders and named blockers (2026-08-21
 * drive finding #8).
 *
 *  - A cancelled order must never block end-shift, on either guard branch:
 *    the dispatch branch checks `cr.status` / `od.status`, and the deliveries
 *    mirror branch ignores rows whose order is CANCELLED (legacy rows written
 *    before the cancel cascade existed).
 *  - The guard names the blocking order(s) in the error and returns them as
 *    `blockingOrders`, keeping `activeDeliveries` for older clients.
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

import { endDriverShift } from "../driver-actions";
import { prisma } from "@/utils/prismaDB";
import { callerMayActOnDriver, getActionCaller } from "@/lib/auth/driver-ownership";
import { getTrackingSettings } from "@/services/tracking/tracking-settings";
import { calculateShiftMileage } from "@/services/tracking/mileage";
import { TRACKING_SETTINGS_DEFAULTS } from "@/types/tracking-settings";
import { END_SHIFT_STALE_PICKUP_HOURS } from "@/lib/driver/end-shift-blockers";

const mockQueryRaw = prisma.$queryRawUnsafe as jest.Mock;
const mockExecuteRaw = prisma.$executeRawUnsafe as jest.Mock;

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

type BlockerRow = { order_number: string | null; reason: string };

/** Route the $queryRawUnsafe calls endDriverShift makes. */
function mockEndShiftQueries(blockers: BlockerRow[]) {
  mockQueryRaw.mockImplementation((sql: string) => {
    if (sql.includes("FROM driver_shifts")) {
      return Promise.resolve([{ driver_id: DRIVER_ID, status: "active" }]);
    }
    if (sql.includes("end-shift-blockers")) {
      return Promise.resolve(blockers);
    }
    return Promise.resolve([]);
  });
}

const findGuardSql = (): string => {
  const call = mockQueryRaw.mock.calls.find(
    ([sql]) => typeof sql === "string" && sql.includes("end-shift-blockers"),
  );
  expect(call).toBeDefined();
  return call![0] as string;
};

beforeEach(() => {
  jest.clearAllMocks();
  (callerMayActOnDriver as jest.Mock).mockResolvedValue(true);
  (getActionCaller as jest.Mock).mockResolvedValue({ isPrivileged: false });
  (getTrackingSettings as jest.Mock).mockResolvedValue(TRACKING_SETTINGS_DEFAULTS);
  mockExecuteRaw.mockResolvedValue(undefined);
  (calculateShiftMileage as jest.Mock).mockResolvedValue({
    totalMiles: 1,
    gpsDistanceMiles: 1,
    mileageSource: "gps",
    warnings: [],
  });
});

describe("endDriverShift guard ignores cancelled orders", () => {
  it("excludes CANCELLED catering and on-demand orders from the dispatch branch", async () => {
    mockEndShiftQueries([]);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(true);

    const sql = findGuardSql();
    expect(sql).toContain(`cr.status <> 'CANCELLED'`);
    expect(sql).toContain(`od.status <> 'CANCELLED'`);
    // Soft-delete filters stay in place.
    expect(sql).toContain(`cr."deletedAt" IS NULL`);
    expect(sql).toContain(`od."deletedAt" IS NULL`);
  });

  it("ignores a legacy deliveries row left ASSIGNED after its order was CANCELLED", async () => {
    mockEndShiftQueries([]);

    await endDriverShift(SHIFT_ID, endLocation);

    const sql = findGuardSql();
    // The deliveries mirror is keyed by order_number; a row whose parent
    // order is cancelled must not count, regardless of the mirror's status.
    expect(sql).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM catering_requests \w+\s+WHERE \w+\."orderNumber" = deliveries\.order_number\s+AND \w+\.status = 'CANCELLED'/,
    );
    expect(sql).toMatch(
      /NOT EXISTS\s*\(\s*SELECT 1 FROM on_demand_requests \w+\s+WHERE \w+\."orderNumber" = deliveries\.order_number\s+AND \w+\.status = 'CANCELLED'/,
    );
    expect(sql).toContain("deleted_at IS NULL");
  });
});

describe("endDriverShift guard names the blocking order", () => {
  it("returns blockingOrders and an error that names the order", async () => {
    mockEndShiftQueries([{ order_number: "Test 0821261", reason: "ACTIVE_DELIVERY" }]);

    const res = await endDriverShift(SHIFT_ID, endLocation);

    expect(res.success).toBe(false);
    expect(res.error).toBe(
      "Order Test 0821261 is still assigned to you. Complete it or return it to dispatch before ending your shift.",
    );
    expect(res.blockingOrders).toEqual([
      { orderNumber: "Test 0821261", reason: "ACTIVE_DELIVERY" },
    ]);
    // Backward-compatible count for older clients.
    expect(res.activeDeliveries).toBe(1);

    const shiftClosed = mockExecuteRaw.mock.calls.some(
      ([sql]) => typeof sql === "string" && sql.includes("shift_end"),
    );
    expect(shiftClosed).toBe(false);
  });

  it("lists every blocking order and dedupes an order hit by both branches", async () => {
    mockEndShiftQueries([
      { order_number: "CAT-001", reason: "ACTIVE_DELIVERY" },
      { order_number: "CAT-001", reason: "IN_PROGRESS" },
      { order_number: "OD-002", reason: "PICKUP_DUE" },
    ]);

    const res = await endDriverShift(SHIFT_ID, endLocation);

    expect(res.success).toBe(false);
    expect(res.blockingOrders).toEqual([
      { orderNumber: "CAT-001", reason: "ACTIVE_DELIVERY" },
      { orderNumber: "OD-002", reason: "PICKUP_DUE" },
    ]);
    expect(res.activeDeliveries).toBe(2);
    expect(res.error).toContain("Orders CAT-001 and OD-002 are still assigned to you.");
  });

  it("still blocks (with a generic message) when the blocker has no order number", async () => {
    mockEndShiftQueries([{ order_number: null, reason: "ACTIVE_DELIVERY" }]);

    const res = await endDriverShift(SHIFT_ID, endLocation);

    expect(res.success).toBe(false);
    expect(res.activeDeliveries).toBe(1);
    expect(res.blockingOrders).toEqual([]);
    expect(res.error).toContain("active or due delivery");
  });
});

describe("endDriverShift guard ignores stale not-started work (2026-08-26 deadlock)", () => {
  const LOWER_BOUND = `NOW() - interval '${END_SHIFT_STALE_PICKUP_HOURS} hours'`;

  it("gates not-started deliveries rows on an estimated_pickup_time window instead of blocking unconditionally", async () => {
    mockEndShiftQueries([]);

    await endDriverShift(SHIFT_ID, endLocation);

    const [sql, ...params] = mockQueryRaw.mock.calls.find(
      ([q]) => typeof q === "string" && q.includes("end-shift-blockers"),
    )!;
    // Started rows (any non-terminal status outside the not-started set) still block.
    expect(sql).toContain("UPPER(deliveries.status) NOT IN ('ASSIGNED','PENDING')");
    // Not-started rows block only inside [NOW()-24h, NOW()+guard].
    expect(sql).toMatch(
      /UPPER\(deliveries\.status\) IN \('ASSIGNED','PENDING'\)\s+AND deliveries\.estimated_pickup_time IS NOT NULL\s+AND deliveries\.estimated_pickup_time >= NOW\(\) - interval '24 hours'\s+AND deliveries\.estimated_pickup_time <= NOW\(\) \+ make_interval\(mins => \$2::int\)/,
    );
    expect(params).toEqual([DRIVER_ID, TRACKING_SETTINGS_DEFAULTS.endShiftPickupGuardMinutes]);
  });

  it("applies the 24h lower bound to both branches", async () => {
    mockEndShiftQueries([]);

    await endDriverShift(SHIFT_ID, endLocation);

    const sql = findGuardSql();
    expect(END_SHIFT_STALE_PICKUP_HOURS).toBe(24);
    expect(sql).toContain(`deliveries.estimated_pickup_time >= ${LOWER_BOUND}`);
    expect(sql).toContain(`cr."pickupDateTime" >= ${LOWER_BOUND}`);
    expect(sql).toContain(`od."pickupDateTime" >= ${LOWER_BOUND}`);
    // The window bounds are never built from user input.
    expect(sql).not.toMatch(/interval '\$\d/);
  });

  it("excludes not-started rows entirely when the guard window is 0", async () => {
    (getTrackingSettings as jest.Mock).mockResolvedValue({
      ...TRACKING_SETTINGS_DEFAULTS,
      endShiftPickupGuardMinutes: 0,
    });
    mockEndShiftQueries([]);

    const res = await endDriverShift(SHIFT_ID, endLocation);
    expect(res.success).toBe(true);

    const [sql, ...params] = mockQueryRaw.mock.calls.find(
      ([q]) => typeof q === "string" && q.includes("end-shift-blockers"),
    )!;
    expect(sql).not.toContain("estimated_pickup_time");
    expect(sql).not.toContain("pickupDateTime");
    expect(sql).not.toContain("make_interval");
    expect(sql).not.toContain("$2");
    expect(params).toEqual([DRIVER_ID]);
    // Started rows still block on both branches.
    expect(sql).toContain("UPPER(deliveries.status) NOT IN ('ASSIGNED','PENDING')");
    expect(sql).toContain("EN_ROUTE_TO_VENDOR");
  });
});
