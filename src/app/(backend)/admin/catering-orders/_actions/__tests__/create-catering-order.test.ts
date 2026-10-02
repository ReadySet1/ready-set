/**
 * Tests for createCateringOrder server action — notification dispatch.
 */
import { createCateringOrder } from "../catering-orders";
import { notifyOrderCreated } from "@/services/orders/notifyOrderCreated";
import { runAfterResponse } from "@/lib/api/after-response";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    address: { create: jest.fn() },
    cateringRequest: { create: jest.fn() },
  };
  mockPrisma.$transaction = jest.fn((callback: (tx: any) => unknown) =>
    callback(mockPrisma),
  );
  return { prisma: mockPrisma };
});

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  })),
}));

jest.mock("@/lib/auth/staff-caller", () => ({ getStaffCaller: jest.fn() }));

jest.mock("@/services/orders/notifyOrderCreated");
jest.mock("@/lib/api/after-response", () => ({
  runAfterResponse: jest.fn((_label: string, work: () => Promise<unknown>) => {
    void work();
  }),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validInput = {
  userId: "550e8400-e29b-41d4-a716-446655440000",
  pickupDateTime: new Date("2026-10-01T10:00:00Z"),
  arrivalDateTime: new Date("2026-10-01T11:00:00Z"),
  needHost: "NO" as const,
  hoursNeeded: null,
  numberOfHosts: null,
  headcount: 50,
  orderTotal: 500,
  tip: null,
  clientAttention: "Front desk",
  pickupAddress: {
    street1: "123 Vendor St",
    city: "Austin",
    state: "TX",
    zip: "78701",
  },
  deliveryAddress: {
    street1: "456 Client Ave",
    city: "Austin",
    state: "TX",
    zip: "78702",
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createCateringOrder — caller authorization", () => {
  const { prisma } = jest.requireMock("@/lib/db/prisma");
  const { getStaffCaller } = jest.requireMock("@/lib/auth/staff-caller");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects callers that are not staff (or not signed in) without writing anything", async () => {
    getStaffCaller.mockResolvedValue(null);

    const result = await createCateringOrder(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notifyOrderCreated).not.toHaveBeenCalled();
  });
});

describe("createCateringOrder — notification dispatch", () => {
  const { prisma } = jest.requireMock("@/lib/db/prisma");
  const { getStaffCaller } = jest.requireMock("@/lib/auth/staff-caller");
  const NEW_ORDER_ID = "order-new-1";

  beforeEach(() => {
    jest.clearAllMocks();
    getStaffCaller.mockResolvedValue({ userId: "admin-1", isPrivileged: true });
    prisma.address.create.mockResolvedValue({ id: "addr-new" });
    prisma.cateringRequest.create.mockResolvedValue({
      id: NEW_ORDER_ID,
      orderNumber: "CATER-test",
    });
  });

  it("dispatches admin notification with source 'admin_dashboard' after order creation", async () => {
    const result = await createCateringOrder(validInput);

    expect(result.success).toBe(true);
    expect(runAfterResponse).toHaveBeenCalledWith(
      "admin-order-notification",
      expect.any(Function),
    );
    expect(notifyOrderCreated).toHaveBeenCalledWith({
      orderId: NEW_ORDER_ID,
      orderType: "catering",
      source: "admin_dashboard",
    });
  });
});
