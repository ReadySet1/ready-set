/**
 * Security tests for the updateDeliveryStatus server action.
 *
 * Guards added in the driver-redesign hardening pass (OWASP A01 / IDOR):
 *  - the caller must be authenticated
 *  - a non-admin caller may only mutate a delivery assigned to their own driver
 *  - the deliveryId must be a valid UUID before it reaches raw SQL
 */

import { updateDeliveryStatus } from "../delivery-actions";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";
import { DriverStatus } from "@/types/user";

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
  },
}));
jest.mock("@/utils/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getUserRole: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const mockPrisma = prisma as unknown as {
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
};
const mockCreateClient = createClient as jest.Mock;
const mockGetUserRole = getUserRole as jest.Mock;

const VALID_ID = "11111111-1111-4111-8111-111111111111";

function mockAuth(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
});

describe("updateDeliveryStatus security", () => {
  it("rejects an invalid deliveryId before touching the DB", async () => {
    const res = await updateDeliveryStatus("not-a-uuid", DriverStatus.PICKED_UP);
    expect(res).toEqual({ success: false, error: "Invalid deliveryId" });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockAuth(null);
    const res = await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP);
    expect(res).toEqual({ success: false, error: "Authentication required" });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("denies a driver who does not own the delivery (IDOR)", async () => {
    mockAuth({ id: "user-attacker" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) return Promise.resolve([{ driver_id: "driver-victim" }]);
      if (sql.includes("FROM drivers")) return Promise.resolve([]); // not owned
      return Promise.resolve([]);
    });

    const res = await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP);
    expect(res).toEqual({ success: false, error: "Access denied" });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("allows the assigned driver to advance their own delivery", async () => {
    mockAuth({ id: "user-owner" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) return Promise.resolve([{ driver_id: "driver-1" }]);
      if (sql.includes("FROM drivers")) return Promise.resolve([{ id: "driver-1" }]);
      return Promise.resolve([]);
    });

    const res = await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP);
    expect(res).toEqual({ success: true });
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
  });

  it("checks ownership against profile_id as well as user_id", async () => {
    // Most drivers rows only have profile_id set (user_id is a legacy,
    // usually-NULL column). The ownership query must accept either link —
    // a user_id-only check 403s every real driver. Regression for the
    // "Access denied on own delivery" bug.
    mockAuth({ id: "user-owner" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) return Promise.resolve([{ driver_id: "driver-1" }]);
      if (sql.includes("FROM drivers")) return Promise.resolve([{ id: "driver-1" }]);
      return Promise.resolve([]);
    });

    await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP);

    const ownershipSql = mockPrisma.$queryRawUnsafe.mock.calls
      .map(([sql]) => sql as string)
      .find((sql) => sql.includes("FROM drivers"));
    expect(ownershipSql).toBeDefined();
    expect(ownershipSql).toContain("profile_id");
    expect(ownershipSql).toContain("user_id");
  });

  it("lets an admin advance any delivery without an ownership row", async () => {
    mockAuth({ id: "user-admin" });
    mockGetUserRole.mockResolvedValue("ADMIN");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) return Promise.resolve([{ driver_id: "driver-1" }]);
      return Promise.resolve([]); // ownership lookup must NOT be required
    });

    const res = await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP);
    expect(res).toEqual({ success: true });
  });

  it("does not write a location when coordinates are out of range", async () => {
    mockAuth({ id: "user-owner" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) return Promise.resolve([{ driver_id: "driver-1" }]);
      if (sql.includes("FROM drivers")) return Promise.resolve([{ id: "driver-1" }]);
      return Promise.resolve([]);
    });

    await updateDeliveryStatus(VALID_ID, DriverStatus.PICKED_UP, {
      driverId: "driver-1",
      coordinates: { lat: 999, lng: 999 }, // invalid
      accuracy: 0,
      speed: 0,
      heading: 0,
      isMoving: false,
      activityType: "stationary",
      timestamp: new Date(),
    });

    // Only the deliveries UPDATE should run — never the drivers location UPDATE.
    const ranLocationUpdate = mockPrisma.$executeRawUnsafe.mock.calls.some(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE drivers"),
    );
    expect(ranLocationUpdate).toBe(false);
  });
});
