/**
 * Tests for createOnDemandOrder server action — notification dispatch.
 */
import { createOnDemandOrder } from "../on-demand-orders";
import { notifyOrderCreated } from "@/services/orders/notifyOrderCreated";
import { runAfterResponse } from "@/lib/api/after-response";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    address: { create: jest.fn() },
    onDemand: { create: jest.fn() },
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
  clientAttention: "Reception desk",
  pickupDateTime: new Date("2026-10-01T10:00:00Z"),
  arrivalDateTime: new Date("2026-10-01T11:00:00Z"),
  vehicleType: "VAN" as const,
  orderTotal: 250,
  tip: null,
  hoursNeeded: null,
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

describe("createOnDemandOrder — notification dispatch", () => {
  const { prisma } = jest.requireMock("@/lib/db/prisma");
  const NEW_ORDER_ID = "order-od-new-1";

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.address.create.mockResolvedValue({ id: "addr-new" });
    prisma.onDemand.create.mockResolvedValue({
      id: NEW_ORDER_ID,
      orderNumber: "OD-test",
    });
  });

  it("dispatches admin notification with source 'admin_dashboard' after order creation", async () => {
    const result = await createOnDemandOrder(validInput);

    expect(result.success).toBe(true);
    expect(runAfterResponse).toHaveBeenCalledWith(
      "admin-order-notification",
      expect.any(Function),
    );
    expect(notifyOrderCreated).toHaveBeenCalledWith({
      orderId: NEW_ORDER_ID,
      orderType: "on_demand",
      source: "admin_dashboard",
    });
  });
});
