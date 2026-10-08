jest.mock("@/utils/prismaDB", () => {
  const mock = {
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
    deliveryReturnRequest: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    userAudit: {
      create: jest.fn(),
    },
  };
  return { prisma: mock };
});

jest.mock("@/app/actions/tracking/driver-actions", () => ({
  endDriverShift: jest.fn(),
}));

jest.mock("@sentry/nextjs", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

import { prisma } from "@/utils/prismaDB";
import { endDriverShift } from "@/app/actions/tracking/driver-actions";
import {
  adminEndShift,
  getAdminEndShiftPreview,
} from "@/services/tracking/admin-end-shift";

const mockQuery = prisma.$queryRawUnsafe as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;
const mockFindRequests = prisma.deliveryReturnRequest.findMany as jest.Mock;
const mockVoidRequests = prisma.deliveryReturnRequest.updateMany as jest.Mock;
const mockAuditCreate = prisma.userAudit.create as jest.Mock;
const mockEndDriverShift = endDriverShift as jest.Mock;

const SHIFT_ID = "660e8400-e29b-41d4-a716-446655440001";
const DRIVER_ID = "550e8400-e29b-41d4-a716-446655440000";
const PROFILE_ID = "440e8400-e29b-41d4-a716-446655440009";
const SHIFT_START = new Date("2026-10-08T14:00:00Z");
const actor = { id: "admin-1", email: "admin@example.com" };

function shiftRow(status = "active") {
  return {
    id: SHIFT_ID,
    status,
    shift_start: SHIFT_START,
    driver_id: DRIVER_ID,
    profile_id: PROFILE_ID,
    driver_name: "Fernando Sanchez",
  };
}

describe("getAdminEndShiftPreview", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns null when the shift does not exist", async () => {
    mockQuery.mockResolvedValueOnce([]);
    await expect(getAdminEndShiftPreview(SHIFT_ID)).resolves.toBeNull();
  });

  it("lists the driver's open orders and this shift's pending return requests", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]).mockResolvedValueOnce([
      { order_number: "CAT-001", status: "ASSIGNED" },
      { order_number: "CAT-001", status: "EN_ROUTE_TO_VENDOR" },
      { order_number: "OD-002", status: "PICKED_UP" },
    ]);
    mockFindRequests.mockResolvedValueOnce([
      {
        id: "rr-1",
        orderNumber: "CAT-003",
        reason: "VEHICLE_ISSUE",
        requestedAt: new Date("2026-10-08T15:00:00Z"),
      },
    ]);

    const preview = await getAdminEndShiftPreview(SHIFT_ID);

    expect(preview).toEqual({
      shift: {
        id: SHIFT_ID,
        status: "active",
        isOpen: true,
        shiftStart: SHIFT_START.toISOString(),
        driverId: DRIVER_ID,
        driverName: "Fernando Sanchez",
      },
      // Deduped by order number (first row wins).
      openOrders: [
        { orderNumber: "CAT-001", status: "ASSIGNED" },
        { orderNumber: "OD-002", status: "PICKED_UP" },
      ],
      pendingReturnRequests: [
        {
          id: "rr-1",
          orderNumber: "CAT-003",
          reason: "VEHICLE_ISSUE",
          requestedAt: "2026-10-08T15:00:00.000Z",
        },
      ],
    });
    // Return requests are scoped to the driver's profile and this shift.
    expect(mockFindRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          driverId: PROFILE_ID,
          status: "PENDING",
          requestedAt: { gte: SHIFT_START },
        },
      }),
    );
  });
});

describe("adminEndShift", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockTransaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    mockEndDriverShift.mockResolvedValue({ success: true });
    mockVoidRequests.mockResolvedValue({ count: 0 });
    mockAuditCreate.mockResolvedValue({ id: "audit-1" });
    // Open-orders snapshot for the audit trail.
    mockQuery.mockResolvedValue([]);
  });

  it("returns NOT_FOUND when the shift does not exist", async () => {
    mockQuery.mockResolvedValueOnce([]);

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Stuck",
      actor,
    });

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      error: "Shift not found",
    });
    expect(mockEndDriverShift).not.toHaveBeenCalled();
  });

  it("returns ALREADY_ENDED for a completed shift without touching anything", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow("completed")]);

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Stuck",
      actor,
    });

    expect(result).toMatchObject({ ok: false, code: "ALREADY_ENDED" });
    expect(mockEndDriverShift).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("closes an open shift through endDriverShift with force and an admin note", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]);

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "  Driver phone died  ",
      actor,
    });

    expect(result).toEqual({
      ok: true,
      shiftId: SHIFT_ID,
      voidedReturnRequests: 0,
    });
    expect(mockEndDriverShift).toHaveBeenCalledWith(
      SHIFT_ID,
      null,
      undefined,
      expect.objectContaining({
        force: true,
        notes: expect.stringContaining("Driver phone died"),
      }),
    );
    expect(mockEndDriverShift.mock.calls[0][3].notes).toContain(
      "admin@example.com",
    );
  });

  it("writes an audit row: who, when, reason, and what was left open", async () => {
    mockQuery
      .mockResolvedValueOnce([shiftRow("paused")])
      .mockResolvedValueOnce([{ order_number: "CAT-001", status: "ASSIGNED" }]);

    await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Driver phone died",
      actor,
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const { data } = mockAuditCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: PROFILE_ID,
      action: "STATUS_CHANGE",
      performedBy: actor.id,
      reason: "Driver phone died",
      changes: {
        before: { shiftStatus: "paused" },
        after: { shiftStatus: "completed" },
      },
      metadata: expect.objectContaining({
        event: "ADMIN_SHIFT_END",
        shiftId: SHIFT_ID,
        driverId: DRIVER_ID,
        openOrders: ["CAT-001"],
        voidedReturnRequests: 0,
        endedAt: expect.any(String),
      }),
    });
  });

  it("leaves pending return requests alone unless the admin opts in", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]);

    await adminEndShift({ shiftId: SHIFT_ID, reason: "Stuck", actor });

    expect(mockVoidRequests).not.toHaveBeenCalled();
  });

  it("voids this shift's pending return requests when asked, with the reason", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]);
    mockVoidRequests.mockResolvedValueOnce({ count: 2 });

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Test drive cleanup",
      voidReturnRequests: true,
      actor,
    });

    expect(result).toEqual({
      ok: true,
      shiftId: SHIFT_ID,
      voidedReturnRequests: 2,
    });
    expect(mockVoidRequests).toHaveBeenCalledWith({
      where: {
        driverId: PROFILE_ID,
        status: "PENDING",
        requestedAt: { gte: SHIFT_START },
      },
      data: {
        status: "VOIDED",
        resolvedAt: expect.any(Date),
        resolvedBy: actor.id,
        resolutionNotes:
          "Voided when an admin ended the shift: Test drive cleanup",
      },
    });
  });

  it("reports a race (shift ended meanwhile) as ALREADY_ENDED and writes no audit", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]);
    mockEndDriverShift.mockResolvedValueOnce({
      success: false,
      error: "Active shift not found",
    });

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Stuck",
      actor,
    });

    expect(result).toMatchObject({ ok: false, code: "ALREADY_ENDED" });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("surfaces other end failures as END_FAILED", async () => {
    mockQuery.mockResolvedValueOnce([shiftRow()]);
    mockEndDriverShift.mockResolvedValueOnce({
      success: false,
      error: "Access denied",
    });

    const result = await adminEndShift({
      shiftId: SHIFT_ID,
      reason: "Stuck",
      actor,
    });

    expect(result).toEqual({
      ok: false,
      code: "END_FAILED",
      error: "Access denied",
    });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
