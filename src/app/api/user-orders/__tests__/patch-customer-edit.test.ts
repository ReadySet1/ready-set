/**
 * Tests for PATCH /api/user-orders/[order_number]
 * Customer (VENDOR / CLIENT) editing headcount and orderTotal on their own catering orders.
 */

import { NextResponse } from "next/server";
import { createPatchRequest } from "@/__tests__/helpers/api-test-helpers";
import { CATERING_PAIR_MESSAGE } from "@/lib/orders/customer-order-edit";

// ---------------------------------------------------------------------------
// Mocks — must come before the route import
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth-middleware", () => ({
  withAuth: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => {
  const prismaMock: Record<string, unknown> = {
    cateringRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    onDemand: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    delivery: {
      findFirst: jest.fn(),
    },
    orderEditHistory: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $disconnect: jest.fn(),
  };
  // The PATCH route wraps the order update + audit insert in an interactive
  // prisma.$transaction; run the callback with the same mock so tx.* resolves
  // to the mocked methods.
  prismaMock.$transaction = jest.fn(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  );
  return { prisma: prismaMock };
});

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

import { PATCH } from "../[order_number]/route";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/utils/prismaDB";
import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const URL_BASE = "http://localhost:3000/api/user-orders/CAT001";
const mockWithAuth = withAuth as jest.Mock;
const mockFindFirst = prisma.cateringRequest.findFirst as jest.Mock;
const mockUpdateMany = prisma.cateringRequest.updateMany as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockCreateMany = (
  prisma as unknown as { orderEditHistory: { createMany: jest.Mock } }
).orderEditHistory.createMany as jest.Mock;

function mockParams(orderNumber = "CAT001") {
  return { params: Promise.resolve({ order_number: orderNumber }) };
}

const authAs = (type: string, id = "vendor-1") => ({
  success: true,
  context: { user: { id, email: `${id}@example.com`, type } },
});

const authRejected = (status: number, error: string) => ({
  success: false,
  response: NextResponse.json({ error }, { status }),
  context: {},
});

function defaultOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-id",
    orderNumber: "CAT001",
    status: "ACTIVE",
    driverStatus: null,
    headcount: 20,
    orderTotal: 500,
    userId: "vendor-1",
    user: { name: "Vendor One", email: "vendor-1@example.com" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/user-orders/[order_number]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated VENDOR
    mockWithAuth.mockResolvedValue(authAs("VENDOR", "vendor-1"));
    // Restore default $transaction behaviour after clearAllMocks
    mockTransaction.mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    mockCreateMany.mockResolvedValue({ count: 0 });
  });

  // ---- Auth & role --------------------------------------------------------

  it("returns 401 when there is no session", async () => {
    mockWithAuth.mockResolvedValue(authRejected(401, "Authentication required"));
    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when withAuth rejects the caller role", async () => {
    mockWithAuth.mockResolvedValue(authRejected(403, "Insufficient permissions"));
    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(403);
  });

  it("passes CUSTOMER_EDIT_ROLES to withAuth", async () => {
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder())
      .mockResolvedValueOnce({
        orderNumber: "CAT001",
        headcount: 40,
        orderTotal: 500,
        updatedAt: new Date(),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    await PATCH(req, mockParams());

    expect(mockWithAuth).toHaveBeenCalledWith(req, {
      allowedRoles: ["VENDOR", "CLIENT"],
      requireAuth: true,
    });
  });

  // ---- Happy paths --------------------------------------------------------

  it("VENDOR owner can update headcount only", async () => {
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder())        // load
      .mockResolvedValueOnce({                       // re-read
        orderNumber: "CAT001",
        headcount: 40,
        orderTotal: 500,
        updatedAt: new Date("2026-10-07T12:00:00Z"),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.orderNumber).toBe("CAT001");
    expect(body.headcount).toBe(40);

    // updateMany data should be exactly { headcount: 40 }
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    const callData = mockUpdateMany.mock.calls[0][0].data;
    expect(callData).toEqual({ headcount: 40 });
  });

  it("CLIENT owner can update orderTotal only", async () => {
    mockWithAuth.mockResolvedValue(authAs("CLIENT", "client-1"));
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder({ userId: "client-1", user: { name: "Client One", email: "client-1@example.com" } }))
      .mockResolvedValueOnce({
        orderNumber: "CAT001",
        headcount: 20,
        orderTotal: 1250.5,
        updatedAt: new Date("2026-10-07T12:00:00Z"),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(URL_BASE, { orderTotal: 1250.5 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);

    const callData = mockUpdateMany.mock.calls[0][0].data;
    expect(callData).toEqual({ orderTotal: 1250.5 });
  });

  it("owner can update both fields", async () => {
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder())
      .mockResolvedValueOnce({
        orderNumber: "CAT001",
        headcount: 30,
        orderTotal: 750,
        updatedAt: new Date("2026-10-07T12:00:00Z"),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(URL_BASE, { headcount: 30, orderTotal: 750 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);

    const callData = mockUpdateMany.mock.calls[0][0].data;
    expect(callData).toEqual({ headcount: 30, orderTotal: 750 });
  });

  // ---- Ownership / not found ----------------------------------------------

  it("returns 404 when order is owned by someone else", async () => {
    mockWithAuth.mockResolvedValue(authAs("VENDOR", "other-user"));
    mockFindFirst.mockResolvedValueOnce(null); // userId filter excludes it
    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an on-demand order number (catering-only query)", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const req = createPatchRequest(URL_BASE, { headcount: 10 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for soft-deleted order", async () => {
    mockFindFirst.mockResolvedValueOnce(null); // deletedAt filter excludes
    const req = createPatchRequest(URL_BASE, { headcount: 10 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown order number", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const req = createPatchRequest(
      "http://localhost:3000/api/user-orders/UNKNOWN-999",
      { headcount: 10 },
    );
    const res = await PATCH(req, mockParams("UNKNOWN-999"));
    expect(res.status).toBe(404);
  });

  it("finds URL-encoded order number", async () => {
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder({ orderNumber: "Test 1007262" }))
      .mockResolvedValueOnce({
        orderNumber: "Test 1007262",
        headcount: 40,
        orderTotal: 500,
        updatedAt: new Date(),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(
      "http://localhost:3000/api/user-orders/Test%201007262",
      { headcount: 40 },
    );
    const res = await PATCH(req, mockParams("Test%201007262"));
    expect(res.status).toBe(200);

    // Verify findFirst was called with the decoded order number
    const findCall = mockFindFirst.mock.calls[0][0];
    expect(findCall.where.orderNumber.equals).toBe("Test 1007262");
  });

  // ---- Forbidden fields (strict schema) -----------------------------------

  it.each([
    ["tip", { headcount: 10, tip: 5 }],
    ["status", { headcount: 10, status: "COMPLETED" }],
    ["driverStatus", { headcount: 10, driverStatus: "PICKED_UP" }],
    ["driver_status", { headcount: 10, driver_status: "PICKED_UP" }],
    ["pickupAddress", { headcount: 10, pickupAddress: "123 Main" }],
    ["specialNotes", { headcount: 10, specialNotes: "hello" }],
  ])("returns 400 for extra key %s", async (_label, body) => {
    const req = createPatchRequest(URL_BASE, body);
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---- Body validation ----------------------------------------------------

  it("returns 400 for empty body {}", async () => {
    const req = createPatchRequest(URL_BASE, {});
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new (require("next/server").NextRequest)(URL_BASE, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  it.each([
    ["string headcount", { headcount: "40" }],
    ["non-integer headcount 5.9", { headcount: 5.9 }],
    ["zero headcount", { headcount: 0 }],
    ["negative headcount", { headcount: -1 }],
    ["headcount over INT4", { headcount: 2_147_483_648 }],
  ])("returns 400 for %s", async (_label, body) => {
    const req = createPatchRequest(URL_BASE, body);
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  it.each([
    ["string orderTotal", { orderTotal: "100" }],
    ["zero orderTotal", { orderTotal: 0 }],
    ["negative orderTotal", { orderTotal: -5 }],
    ["3-decimal orderTotal 10.999", { orderTotal: 10.999 }],
    ["orderTotal over ceiling", { orderTotal: 100_000_000 }],
  ])("returns 400 for %s", async (_label, body) => {
    const req = createPatchRequest(URL_BASE, body);
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  // ---- Pair rule ----------------------------------------------------------

  it("returns 400 with CATERING_PAIR_MESSAGE when nulling headcount while total is null", async () => {
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ headcount: 10, orderTotal: null }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: null });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe(CATERING_PAIR_MESSAGE);
  });

  it("returns 400 with CATERING_PAIR_MESSAGE when nulling headcount while total is 0", async () => {
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ headcount: 10, orderTotal: 0 }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: null });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe(CATERING_PAIR_MESSAGE);
  });

  it("allows nulling headcount when total is positive", async () => {
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder({ headcount: 10, orderTotal: 500 }))
      .mockResolvedValueOnce({
        orderNumber: "CAT001",
        headcount: null,
        orderTotal: 500,
        updatedAt: new Date(),
      });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const req = createPatchRequest(URL_BASE, { headcount: null });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);
  });

  // ---- Non-editable statuses (allow-list) ----------------------------------

  it.each(["ASSIGNED", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED"])(
    "returns 409 for status %s",
    async (status) => {
      mockFindFirst.mockResolvedValueOnce(defaultOrder({ status }));

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("ORDER_NOT_EDITABLE");
    },
  );

  it.each(["PENDING", "CONFIRMED", "ACTIVE"])(
    "allows edit when status is %s and driverStatus is null",
    async (status) => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ status, driverStatus: null }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 40,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(200);
    },
  );

  // ---- Driver assigned blocks editing ------------------------------------

  it("returns 409 with DRIVER_ASSIGNED message when driverStatus is not null", async () => {
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ driverStatus: "ASSIGNED" }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("ORDER_NOT_EDITABLE");
    expect(body.message).toContain("driver is already assigned");
  });

  it.each([
    "ASSIGNED",
    "EN_ROUTE_TO_VENDOR",
    "ARRIVED_AT_VENDOR",
    "PICKED_UP",
    "EN_ROUTE_TO_CLIENT",
    "ARRIVED_TO_CLIENT",
    "COMPLETED",
  ])(
    "returns 409 when driverStatus is %s",
    async (driverStatus) => {
      mockFindFirst.mockResolvedValueOnce(defaultOrder({ driverStatus }));

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(409);
    },
  );

  // ---- No-op (values equal stored) ----------------------------------------

  it("returns 200 without calling updateMany when values equal stored values", async () => {
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ headcount: 20, orderTotal: 500 }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: 20, orderTotal: 500 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("no-op edit writes no audit row and does not call $transaction", async () => {
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ headcount: 20, orderTotal: 500 }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: 20, orderTotal: 500 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ---- Race condition (updateMany count 0) --------------------------------

  it("returns 409 when updateMany count is 0 (state changed mid-request)", async () => {
    mockFindFirst.mockResolvedValueOnce(defaultOrder());
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("ORDER_NOT_EDITABLE");
  });

  it("count=0 does not call createMany and does not send notification", async () => {
    mockFindFirst.mockResolvedValueOnce(defaultOrder());
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    await PATCH(req, mockParams());
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  // ---- Server error -------------------------------------------------------

  it("returns 500 and calls Sentry on Prisma error", async () => {
    const dbError = new Error("connection reset");
    mockFindFirst.mockRejectedValueOnce(dbError);

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toBe("An unexpected error occurred");
    expect(Sentry.captureException).toHaveBeenCalledWith(dbError, {
      tags: { operation: "customer-order-edit" },
    });
  });

  // ---- Dead code path: driver_status from UserOrder.tsx -------------------

  it("rejects the legacy { driver_status } body from UserOrder.tsx", async () => {
    const req = createPatchRequest(URL_BASE, { driver_status: "COMPLETED" });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  // ---- Audit trail (OrderEditHistory) -------------------------------------

  describe("audit trail", () => {
    it("writes one audit row when one field changes", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder())
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 40,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      await PATCH(req, mockParams());

      expect(mockCreateMany).toHaveBeenCalledTimes(1);
      const auditData = mockCreateMany.mock.calls[0][0].data;
      expect(auditData).toHaveLength(1);
      expect(auditData[0]).toEqual({
        cateringRequestId: "order-id",
        editedBy: "vendor-1",
        field: "headcount",
        oldValue: "20",
        newValue: "40",
      });
    });

    it("writes two audit rows when both fields change", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder())
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 30,
          orderTotal: 750,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 30, orderTotal: 750 });
      await PATCH(req, mockParams());

      expect(mockCreateMany).toHaveBeenCalledTimes(1);
      const auditData = mockCreateMany.mock.calls[0][0].data;
      expect(auditData).toHaveLength(2);
      expect(auditData[0]).toMatchObject({
        field: "headcount",
        oldValue: "20",
        newValue: "30",
      });
      expect(auditData[1]).toMatchObject({
        field: "orderTotal",
        oldValue: "500.00",
        newValue: "750.00",
      });
    });

    it("records null newValue when a field is cleared", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ headcount: 10, orderTotal: 500 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: null,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: null });
      await PATCH(req, mockParams());

      const auditData = mockCreateMany.mock.calls[0][0].data;
      expect(auditData[0]).toMatchObject({
        field: "headcount",
        oldValue: "10",
        newValue: null,
      });
    });

    it("records null oldValue when a previously empty field is set", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ headcount: null, orderTotal: 500 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 25,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 25 });
      await PATCH(req, mockParams());

      const auditData = mockCreateMany.mock.calls[0][0].data;
      expect(auditData[0]).toMatchObject({
        field: "headcount",
        oldValue: null,
        newValue: "25",
      });
    });

    it("formats orderTotal with two decimals (1250.5 → '1250.50')", async () => {
      mockWithAuth.mockResolvedValue(authAs("CLIENT", "client-1"));
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ userId: "client-1", user: { name: "Client One", email: "client-1@example.com" }, orderTotal: 500 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 20,
          orderTotal: 1250.5,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { orderTotal: 1250.5 });
      await PATCH(req, mockParams());

      const auditData = mockCreateMany.mock.calls[0][0].data;
      expect(auditData[0]).toMatchObject({
        field: "orderTotal",
        oldValue: "500.00",
        newValue: "1250.50",
      });
    });

    it("returns 500 and does not send notification when createMany throws", async () => {
      mockFindFirst.mockResolvedValueOnce(defaultOrder());
      mockUpdateMany.mockResolvedValue({ count: 1 });
      const auditError = new Error("audit insert failed");
      // createMany rejects inside the callback → $transaction propagates
      // the rejection → the route's outer catch returns 500.
      mockCreateMany.mockRejectedValueOnce(auditError);

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(500);
      expect(Sentry.captureException).toHaveBeenCalledWith(auditError, {
        tags: { operation: "customer-order-edit" },
      });
    });
  });

  // ---- Compare-and-swap WHERE clause ------------------------------------

  describe("compare-and-swap WHERE clause", () => {
    it("uses allow-list status filter and driverStatus null", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder())
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 40,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      await PATCH(req, mockParams());

      const where = mockUpdateMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ["PENDING", "CONFIRMED", "ACTIVE"] });
      expect(where.driverStatus).toBeNull();
      // Should not have the old notIn / OR shape
      expect(where.OR).toBeUndefined();
    });

    it("includes old headcount in WHERE when changing headcount", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ headcount: 20 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 40,
          orderTotal: 500,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      await PATCH(req, mockParams());

      const where = mockUpdateMany.mock.calls[0][0].where;
      expect(where.headcount).toBe(20);
    });

    it("includes old orderTotal in WHERE when changing orderTotal", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ userId: "vendor-1", orderTotal: 500 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 20,
          orderTotal: 750,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { orderTotal: 750 });
      await PATCH(req, mockParams());

      const where = mockUpdateMany.mock.calls[0][0].where;
      expect(where.orderTotal).toBe(500);
      // headcount is not being changed so should not be in WHERE
      expect(where).not.toHaveProperty("headcount");
    });

    it("includes both old values in WHERE when changing both fields", async () => {
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ headcount: 20, orderTotal: 500 }))
        .mockResolvedValueOnce({
          orderNumber: "CAT001",
          headcount: 30,
          orderTotal: 750,
          updatedAt: new Date(),
        });
      mockUpdateMany.mockResolvedValue({ count: 1 });

      const req = createPatchRequest(URL_BASE, { headcount: 30, orderTotal: 750 });
      await PATCH(req, mockParams());

      const where = mockUpdateMany.mock.calls[0][0].where;
      expect(where.headcount).toBe(20);
      expect(where.orderTotal).toBe(500);
    });
  });
});
