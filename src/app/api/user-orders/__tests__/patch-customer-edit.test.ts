/**
 * Tests for PATCH /api/user-orders/[order_number]
 * Customer (VENDOR / CLIENT) editing headcount and orderTotal on their own catering orders.
 */

import { createPatchRequest } from "@/__tests__/helpers/api-test-helpers";
import { CATERING_PAIR_MESSAGE } from "@/lib/orders/customer-order-edit";

// ---------------------------------------------------------------------------
// Mocks — must come before the route import
// ---------------------------------------------------------------------------

jest.mock("@/utils/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
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
    $disconnect: jest.fn(),
  },
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

import { PATCH } from "../[order_number]/route";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/utils/prismaDB";
import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const URL_BASE = "http://localhost:3000/api/user-orders/CAT001";
const mockCreateClient = createClient as jest.Mock;
const mockFindFirst = prisma.cateringRequest.findFirst as jest.Mock;
const mockUpdateMany = prisma.cateringRequest.updateMany as jest.Mock;

function mockParams(orderNumber = "CAT001") {
  return { params: Promise.resolve({ order_number: orderNumber }) };
}

function setupAuth(
  userId: string | null,
  role: string | null,
) {
  const user = userId ? { id: userId, email: `${userId}@example.com` } : null;
  const from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(
          role ? { data: { type: role }, error: null } : { data: null, error: { message: "not found" } },
        ),
      }),
    }),
  });

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from,
  });
}

function defaultOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-id",
    orderNumber: "CAT001",
    status: "ACTIVE",
    driverStatus: null,
    headcount: 20,
    orderTotal: 500,
    userId: "vendor-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/user-orders/[order_number]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- Auth & role --------------------------------------------------------

  it("returns 401 when there is no session", async () => {
    setupAuth(null, null);
    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(401);
  });

  it.each(["ADMIN", "HELPDESK", "DRIVER", "SUPER_ADMIN"])(
    "returns 403 for %s caller",
    async (role) => {
      setupAuth("user-1", role);
      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(403);
    },
  );

  // ---- Happy paths --------------------------------------------------------

  it("VENDOR owner can update headcount only", async () => {
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("client-1", "CLIENT");
    mockFindFirst
      .mockResolvedValueOnce(defaultOrder({ userId: "client-1" }))
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
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("other-user", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(null); // userId filter excludes it
    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an on-demand order number (catering-only query)", async () => {
    setupAuth("vendor-1", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(null);
    const req = createPatchRequest(URL_BASE, { headcount: 10 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for soft-deleted order", async () => {
    setupAuth("vendor-1", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(null); // deletedAt filter excludes
    const req = createPatchRequest(URL_BASE, { headcount: 10 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown order number", async () => {
    setupAuth("vendor-1", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(null);
    const req = createPatchRequest(
      "http://localhost:3000/api/user-orders/UNKNOWN-999",
      { headcount: 10 },
    );
    const res = await PATCH(req, mockParams("UNKNOWN-999"));
    expect(res.status).toBe(404);
  });

  it("finds URL-encoded order number", async () => {
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
    const req = createPatchRequest(URL_BASE, body);
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---- Body validation ----------------------------------------------------

  it("returns 400 for empty body {}", async () => {
    setupAuth("vendor-1", "VENDOR");
    const req = createPatchRequest(URL_BASE, {});
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
    const req = createPatchRequest(URL_BASE, body);
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });

  // ---- Pair rule ----------------------------------------------------------

  it("returns 400 with CATERING_PAIR_MESSAGE when nulling headcount while total is null", async () => {
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
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

  // ---- Terminal statuses --------------------------------------------------

  it.each(["COMPLETED", "DELIVERED", "CANCELLED"])(
    "returns 409 for status %s",
    async (status) => {
      setupAuth("vendor-1", "VENDOR");
      mockFindFirst.mockResolvedValueOnce(defaultOrder({ status }));

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("ORDER_NOT_EDITABLE");
    },
  );

  // ---- Driver status locks ------------------------------------------------

  it.each(["PICKED_UP", "EN_ROUTE_TO_CLIENT", "ARRIVED_TO_CLIENT", "COMPLETED"])(
    "returns 409 when driverStatus is %s",
    async (driverStatus) => {
      setupAuth("vendor-1", "VENDOR");
      mockFindFirst.mockResolvedValueOnce(defaultOrder({ driverStatus }));

      const req = createPatchRequest(URL_BASE, { headcount: 40 });
      const res = await PATCH(req, mockParams());
      expect(res.status).toBe(409);
    },
  );

  it.each([null, "ASSIGNED", "EN_ROUTE_TO_VENDOR", "ARRIVED_AT_VENDOR"])(
    "allows edit when driverStatus is %s",
    async (driverStatus) => {
      setupAuth("vendor-1", "VENDOR");
      mockFindFirst
        .mockResolvedValueOnce(defaultOrder({ driverStatus }))
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

  // ---- No-op (values equal stored) ----------------------------------------

  it("returns 200 without calling updateMany when values equal stored values", async () => {
    setupAuth("vendor-1", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(
      defaultOrder({ headcount: 20, orderTotal: 500 }),
    );

    const req = createPatchRequest(URL_BASE, { headcount: 20, orderTotal: 500 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(200);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  // ---- Race condition (updateMany count 0) --------------------------------

  it("returns 409 when updateMany count is 0 (state changed mid-request)", async () => {
    setupAuth("vendor-1", "VENDOR");
    mockFindFirst.mockResolvedValueOnce(defaultOrder());
    mockUpdateMany.mockResolvedValue({ count: 0 });

    const req = createPatchRequest(URL_BASE, { headcount: 40 });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("ORDER_NOT_EDITABLE");
  });

  // ---- Server error -------------------------------------------------------

  it("returns 500 and calls Sentry on Prisma error", async () => {
    setupAuth("vendor-1", "VENDOR");
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
    setupAuth("vendor-1", "VENDOR");
    const req = createPatchRequest(URL_BASE, { driver_status: "COMPLETED" });
    const res = await PATCH(req, mockParams());
    expect(res.status).toBe(400);
  });
});
