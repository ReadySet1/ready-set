/**
 * Tests for /api/drivers/[driverId]/history and /api/drivers/[driverId]/history/export
 *
 * These routes expose driver shift/delivery history (JSON, CSV, PDF).
 *
 * Tests cover:
 * - 401 for unauthenticated requests (via withAuth)
 * - 400 for non-UUID driver ids (must not reach Prisma, which throws → 500)
 * - 404 for unknown drivers
 * - 403 for a driver requesting another driver's history
 * - 200 for own data and for admins on any driver
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as getHistory } from "../route";
import { GET as getExport } from "../export/route";
import { withAuth } from "@/lib/auth-middleware";
import { getDriverForUser } from "@/lib/auth/driver-ownership";
import { prisma } from "@/utils/prismaDB";
import {
  generateDriverHistoryPDF,
  generateDriverHistoryCSV,
} from "@/lib/pdf/driver-history-pdf";
import { createGetRequest } from "@/__tests__/helpers/api-test-helpers";

jest.mock("@/lib/auth-middleware", () => ({
  withAuth: jest.fn(),
}));

jest.mock("@/lib/auth/driver-ownership", () => ({
  getDriverForUser: jest.fn(),
}));

jest.mock("@/utils/prismaDB", () => ({
  prisma: {
    driver: {
      findFirst: jest.fn(),
    },
    driverWeeklySummary: {
      findMany: jest.fn(),
    },
    driverShift: {
      findMany: jest.fn(),
    },
    delivery: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock("@/lib/pdf/driver-history-pdf", () => ({
  generateDriverHistoryPDF: jest.fn(),
  generateDriverHistoryCSV: jest.fn(),
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

// next.config.js modularizeImports rewrites `date-fns` named imports to
// `date-fns/{{member}}`, whose CJS interop leaves `.default` undefined under
// jest. Mock the submodules the routes use.
jest.mock("date-fns/format", () => {
  const fn = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
  return { __esModule: true, default: fn, format: fn };
});
jest.mock("date-fns/parseISO", () => {
  const fn = (s: string) => new Date(s);
  return { __esModule: true, default: fn, parseISO: fn };
});
jest.mock("date-fns/subWeeks", () => {
  const fn = (d: Date | string, n: number) =>
    new Date(new Date(d).getTime() - n * 7 * 24 * 60 * 60 * 1000);
  return { __esModule: true, default: fn, subWeeks: fn };
});
jest.mock("date-fns/startOfWeek", () => {
  const fn = (d: Date | string) => new Date(d);
  return { __esModule: true, default: fn, startOfWeek: fn };
});

const mockWithAuth = withAuth as jest.MockedFunction<typeof withAuth>;
const mockGetDriverForUser = getDriverForUser as jest.MockedFunction<
  typeof getDriverForUser
>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGeneratePDF = generateDriverHistoryPDF as jest.MockedFunction<
  typeof generateDriverHistoryPDF
>;
const mockGenerateCSV = generateDriverHistoryCSV as jest.MockedFunction<
  typeof generateDriverHistoryCSV
>;

const DRIVER_ID = "05295b7a-0000-4000-8000-000000000001";
const OTHER_DRIVER_ID = "05295b7a-0000-4000-8000-000000000002";
const AUTH_USER_ID = "3d3de599-0000-4000-8000-000000000003";

const driverRow = {
  id: DRIVER_ID,
  employeeId: "driver-test",
  vehicleNumber: "V-1",
  profile: { id: AUTH_USER_ID, name: "Test Driver", email: "driver.test@example.com" },
};

function authAs(type: "DRIVER" | "ADMIN", id = AUTH_USER_ID) {
  mockWithAuth.mockResolvedValueOnce({
    success: true,
    context: {
      user: { id, email: "x@example.com", type },
    },
  } as any);
}

function authRejected(status = 401) {
  mockWithAuth.mockResolvedValueOnce({
    success: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status }),
    context: { user: { id: "", email: "", type: "CLIENT" } },
  } as any);
}

function makeContext(driverId: string) {
  return { params: Promise.resolve({ driverId }) };
}

function historyRequest(driverId: string, query = ""): NextRequest {
  return createGetRequest(
    `http://localhost:3000/api/drivers/${driverId}/history${query}`
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([]);
  (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([]);
  (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  (mockPrisma.delivery.count as jest.Mock).mockResolvedValue(0);
});

describe("GET /api/drivers/[driverId]/history", () => {
  it("returns 401 when unauthenticated", async () => {
    authRejected();
    const res = await getHistory(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(401);
    expect(mockPrisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-UUID driver id without touching Prisma", async () => {
    authAs("ADMIN");
    const res = await getHistory(
      historyRequest("test-driver-id"),
      makeContext("test-driver-id")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid driver ID");
    expect(mockPrisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the driver does not exist", async () => {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const res = await getHistory(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(404);
  });

  it("returns 403 when a driver requests another driver's history", async () => {
    authAs("DRIVER");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce({
      ...driverRow,
      id: OTHER_DRIVER_ID,
    });
    mockGetDriverForUser.mockResolvedValueOnce({
      id: DRIVER_ID,
      isActive: true,
      currentShiftId: null,
    });
    const res = await getHistory(
      historyRequest(OTHER_DRIVER_ID),
      makeContext(OTHER_DRIVER_ID)
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when the caller has no driver row", async () => {
    authAs("DRIVER");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    mockGetDriverForUser.mockResolvedValueOnce(null);
    const res = await getHistory(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(403);
  });

  it("returns 200 with history for the driver's own data", async () => {
    authAs("DRIVER");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    mockGetDriverForUser.mockResolvedValueOnce({
      id: DRIVER_ID,
      isActive: true,
      currentShiftId: null,
    });
    const res = await getHistory(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.driver.id).toBe(DRIVER_ID);
    expect(body.summary).toBeDefined();
    expect(body.weeklySummaries).toEqual([]);
  });

  it("returns 200 for an admin on any driver without an ownership lookup", async () => {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    const res = await getHistory(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(200);
    expect(mockGetDriverForUser).not.toHaveBeenCalled();
  });

  it("returns CSV when format=csv", async () => {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    const res = await getHistory(
      historyRequest(DRIVER_ID, "?format=csv"),
      makeContext(DRIVER_ID)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });
});

describe("GET /api/drivers/[driverId]/history — period totals per week", () => {
  // Weeks (UTC Mondays): 2026-08-10 and 2026-08-17.
  const RANGE = "?startDate=2026-08-03T00:00:00.000Z&endDate=2026-08-23T23:59:59.000Z";

  function summaryRow(overrides: Record<string, unknown> = {}) {
    return {
      weekStart: new Date("2026-08-17T00:00:00.000Z"),
      weekEnd: new Date("2026-08-23T00:00:00.000Z"),
      year: 2026,
      weekNumber: 34,
      totalShifts: 0,
      completedShifts: 0,
      totalShiftHours: 0,
      totalDeliveries: 0,
      completedDeliveries: 0,
      totalMiles: 0,
      gpsMiles: 0,
      generatedAt: new Date("2026-08-24T04:00:00.000Z"),
      updatedAt: new Date("2026-08-24T04:00:00.000Z"),
      ...overrides,
    };
  }

  function shiftRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "shift-0820",
      shiftStart: new Date("2026-08-20T14:00:00.000Z"),
      shiftEnd: new Date("2026-08-20T16:30:00.000Z"),
      status: "completed",
      totalDistanceMiles: 12.5,
      gpsDistanceMiles: 12,
      deliveryCount: 1,
      updatedAt: new Date("2026-08-20T16:30:00.000Z"),
      ...overrides,
    };
  }

  async function fetchHistory(query = RANGE) {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    return getHistory(historyRequest(DRIVER_ID, query), makeContext(DRIVER_ID));
  }

  it("uses live shifts for a week whose summary is a stale zero row", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow(),
    ]);
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([shiftRow()]);

    const res = await fetchHistory();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary).toEqual({
      totalShifts: 1,
      completedShifts: 1,
      totalHours: 2.5,
      totalDeliveries: 1,
      totalMiles: 12.5,
      gpsMiles: 12,
    });
    // The stale row must not be presented as the week's breakdown either.
    expect(body.weeklySummaries).toEqual([]);
  });

  it("uses a fresh summary as is", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow({
        totalShifts: 2,
        completedShifts: 2,
        totalShiftHours: 8,
        totalDeliveries: 5,
        completedDeliveries: 5,
        totalMiles: 40,
        gpsMiles: 38,
      }),
    ]);
    // Already counted by the summary (written after the shift's last change).
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([shiftRow()]);

    const res = await fetchHistory();
    const body = await res.json();

    expect(body.summary).toEqual({
      totalShifts: 2,
      completedShifts: 2,
      totalHours: 8,
      totalDeliveries: 5,
      totalMiles: 40,
      gpsMiles: 38,
    });
    expect(body.weeklySummaries).toHaveLength(1);
  });

  it("treats a summary written before a shift change in its week as stale", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow({
        totalShifts: 1,
        completedShifts: 1,
        totalShiftHours: 1,
        totalDeliveries: 1,
        totalMiles: 3,
        gpsMiles: 3,
      }),
    ]);
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([
      shiftRow({ updatedAt: new Date("2026-08-25T10:00:00.000Z") }),
    ]);

    const body = await (await fetchHistory()).json();
    expect(body.summary.totalMiles).toBe(12.5);
    expect(body.summary.totalHours).toBe(2.5);
  });

  it("sums fresh summaries with live totals for uncovered weeks", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow({
        weekStart: new Date("2026-08-10T00:00:00.000Z"),
        weekEnd: new Date("2026-08-16T00:00:00.000Z"),
        weekNumber: 33,
        totalShifts: 1,
        completedShifts: 1,
        totalShiftHours: 4,
        totalDeliveries: 3,
        completedDeliveries: 3,
        totalMiles: 20,
        gpsMiles: 19,
        updatedAt: new Date("2026-08-17T04:00:00.000Z"),
      }),
    ]);
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([
      // Week 2026-08-17: no summary → live.
      shiftRow(),
      // Week 2026-08-10: covered by the fresh summary → not added again.
      shiftRow({
        id: "shift-0812",
        shiftStart: new Date("2026-08-12T14:00:00.000Z"),
        shiftEnd: new Date("2026-08-12T18:00:00.000Z"),
        totalDistanceMiles: 20,
        gpsDistanceMiles: 19,
        deliveryCount: 3,
        updatedAt: new Date("2026-08-12T18:00:00.000Z"),
      }),
    ]);

    const body = await (await fetchHistory()).json();

    expect(body.summary).toEqual({
      totalShifts: 2,
      completedShifts: 2,
      totalHours: 6.5,
      totalDeliveries: 4,
      totalMiles: 32.5,
      gpsMiles: 31,
    });
    expect(body.weeklySummaries).toHaveLength(1);
    expect(body.weeklySummaries[0].weekStart).toBe("2026-08-10T00:00:00.000Z");
  });

  it("counts delivery rows only outside covered weeks when live shifts report none", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow({
        weekStart: new Date("2026-08-10T00:00:00.000Z"),
        weekEnd: new Date("2026-08-16T00:00:00.000Z"),
        totalDeliveries: 3,
        updatedAt: new Date("2026-08-17T04:00:00.000Z"),
      }),
    ]);
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([
      shiftRow({ deliveryCount: 0 }),
    ]);
    (mockPrisma.delivery.count as jest.Mock).mockResolvedValue(2);

    const body = await (await fetchHistory()).json();

    expect(body.summary.totalDeliveries).toBe(5);
    expect(mockPrisma.delivery.count).toHaveBeenCalledWith({
      where: {
        driverId: DRIVER_ID,
        createdAt: {
          gte: new Date("2026-08-03T00:00:00.000Z"),
          lte: new Date("2026-08-23T23:59:59.000Z"),
        },
        deletedAt: null,
        NOT: [
          {
            createdAt: {
              gte: new Date("2026-08-10T00:00:00.000Z"),
              lt: new Date("2026-08-17T00:00:00.000Z"),
            },
          },
        ],
      },
    });
  });

  it("computes everything from live rows when there are no summaries", async () => {
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([
      shiftRow({ deliveryCount: 0 }),
    ]);
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        id: "archived-1",
        shiftStart: new Date("2026-08-11T14:00:00.000Z"),
        shiftEnd: new Date("2026-08-11T15:00:00.000Z"),
        status: "completed",
        totalDistanceMiles: 5,
        gpsDistanceMiles: 4,
        deliveryCount: 0,
        archivedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ]);
    (mockPrisma.delivery.count as jest.Mock).mockResolvedValue(4);

    const body = await (await fetchHistory()).json();

    expect(body.summary).toEqual({
      totalShifts: 2,
      completedShifts: 2,
      totalHours: 3.5,
      totalDeliveries: 4,
      totalMiles: 17.5,
      gpsMiles: 16,
    });
    expect(body.weeklySummaries).toEqual([]);
    expect(mockPrisma.delivery.count).toHaveBeenCalledWith({
      where: {
        driverId: DRIVER_ID,
        createdAt: {
          gte: new Date("2026-08-03T00:00:00.000Z"),
          lte: new Date("2026-08-23T23:59:59.000Z"),
        },
        deletedAt: null,
      },
    });
  });

  it("lists fresh summary weeks and live weeks in the CSV", async () => {
    (mockPrisma.driverWeeklySummary.findMany as jest.Mock).mockResolvedValue([
      summaryRow({
        weekStart: new Date("2026-08-10T00:00:00.000Z"),
        weekEnd: new Date("2026-08-16T00:00:00.000Z"),
        weekNumber: 33,
        totalShifts: 0,
        updatedAt: new Date("2026-08-17T04:00:00.000Z"),
      }),
    ]);
    (mockPrisma.driverShift.findMany as jest.Mock).mockResolvedValue([shiftRow()]);

    const res = await fetchHistory(`${RANGE}&format=csv`);
    const lines = (await res.text()).split("\n");

    expect(lines).toContain("Week of 2026-08-17,2026-08-17,2026-08-23,1,1,2.5,1,12.5,12.0");
    expect(lines).toContain("Week 33 2026,2026-08-10,2026-08-16,0,0,0.0,0,0.0,0.0");
  });
});

describe("GET /api/drivers/[driverId]/history/export", () => {
  beforeEach(() => {
    mockGeneratePDF.mockResolvedValue({
      success: true,
      buffer: Buffer.from("%PDF-fake"),
      filename: "history.pdf",
    } as any);
    mockGenerateCSV.mockResolvedValue({
      success: true,
      csv: "a,b\n1,2",
      filename: "history.csv",
    } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    authRejected();
    const res = await getExport(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(401);
    expect(mockPrisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-UUID driver id without touching Prisma", async () => {
    authAs("ADMIN");
    const res = await getExport(
      historyRequest("test-driver-id"),
      makeContext("test-driver-id")
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.driver.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the driver does not exist", async () => {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const res = await getExport(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(404);
  });

  it("returns 403 when a driver exports another driver's history", async () => {
    authAs("DRIVER");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce({
      ...driverRow,
      id: OTHER_DRIVER_ID,
    });
    mockGetDriverForUser.mockResolvedValueOnce({
      id: DRIVER_ID,
      isActive: true,
      currentShiftId: null,
    });
    const res = await getExport(
      historyRequest(OTHER_DRIVER_ID),
      makeContext(OTHER_DRIVER_ID)
    );
    expect(res.status).toBe(403);
    expect(mockGeneratePDF).not.toHaveBeenCalled();
  });

  it("returns a PDF for the driver's own data", async () => {
    authAs("DRIVER");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    mockGetDriverForUser.mockResolvedValueOnce({
      id: DRIVER_ID,
      isActive: true,
      currentShiftId: null,
    });
    const res = await getExport(historyRequest(DRIVER_ID), makeContext(DRIVER_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns CSV when format=csv as admin", async () => {
    authAs("ADMIN");
    (mockPrisma.driver.findFirst as jest.Mock).mockResolvedValueOnce(driverRow);
    const res = await getExport(
      historyRequest(DRIVER_ID, "?format=csv"),
      makeContext(DRIVER_ID)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });
});
