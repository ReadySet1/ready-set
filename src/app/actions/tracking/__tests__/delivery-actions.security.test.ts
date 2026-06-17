/**
 * Security tests for the tracking delivery server actions
 * (assignDeliveryToDriver, createDelivery, getDriverDeliveryHistory,
 * uploadProofOfDelivery).
 *
 * Guards added in the driver-redesign hardening pass (OWASP A01 / IDOR):
 *  - the caller must be authenticated
 *  - a non-admin caller may only act on a delivery assigned to their own driver
 *  - the deliveryId/driverId must be a valid UUID before it reaches raw SQL
 */

import {
  assignDeliveryToDriver,
  createDelivery,
  getDriverDeliveryHistory,
  uploadProofOfDelivery,
} from "../delivery-actions";
import { prisma } from "@/utils/prismaDB";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";

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

describe("tracking delivery actions security", () => {
  it("restricts delivery assignment to admins", async () => {
    mockAuth({ id: "user-driver" });
    mockGetUserRole.mockResolvedValue("DRIVER");

    const res = await assignDeliveryToDriver(VALID_ID, VALID_ID);
    expect(res).toEqual({ success: false, error: "Access denied" });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("restricts delivery creation to admins", async () => {
    mockAuth({ id: "user-driver" });
    mockGetUserRole.mockResolvedValue("DRIVER");

    const res = await createDelivery(
      VALID_ID,
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
    );
    expect(res).toEqual({ success: false, error: "Access denied" });
  });

  it("rejects an invalid driverId for delivery history before touching the DB", async () => {
    const res = await getDriverDeliveryHistory("not-a-uuid");
    expect(res).toEqual([]);
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns no delivery history to a driver reading a foreign driver id", async () => {
    mockAuth({ id: "user-attacker" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]); // ownership lookup → not owned

    const res = await getDriverDeliveryHistory(VALID_ID);
    expect(res).toEqual([]);
    // Only the ownership lookup ran — never the deliveries history query.
    const deliveriesQueried = mockPrisma.$queryRawUnsafe.mock.calls.some(
      ([sql]) => typeof sql === "string" && sql.includes("FROM deliveries"),
    );
    expect(deliveriesQueried).toBe(false);
  });

  it("returns delivery history rows to the owning driver", async () => {
    mockAuth({ id: "user-owner" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) {
        return Promise.resolve([
          {
            id: "delivery-1",
            driver_id: VALID_ID,
            status: "COMPLETED",
            pickup_location_geojson: null,
            delivery_location_geojson: null,
            estimated_delivery_time: null,
            delivered_at: null,
            delivery_photo_url: null,
            delivery_notes: null,
            assigned_at: new Date(),
            arrived_at_vendor_at: null,
            picked_up_at: null,
            en_route_at: null,
            arrived_at_client_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);
      }
      if (sql.includes("FROM drivers")) return Promise.resolve([{ id: VALID_ID }]); // owned
      return Promise.resolve([]);
    });

    const res = await getDriverDeliveryHistory(VALID_ID);
    expect(res).toHaveLength(1);
    expect(res[0]?.id).toBe("delivery-1");
    expect(res[0]?.driverId).toBe(VALID_ID);
  });

  it("denies POD upload on a foreign delivery", async () => {
    mockAuth({ id: "user-attacker" });
    mockGetUserRole.mockResolvedValue("DRIVER");
    mockPrisma.$queryRawUnsafe.mockImplementation((sql: string) => {
      if (sql.includes("FROM deliveries")) {
        return Promise.resolve([{ driver_id: "driver-victim" }]);
      }
      return Promise.resolve([]); // not owned
    });

    const res = await uploadProofOfDelivery(VALID_ID, new Blob(["x"]));
    expect(res).toEqual({ success: false, error: "Access denied" });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
