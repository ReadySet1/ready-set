jest.mock("@/lib/auth-middleware");

jest.mock("@/services/tracking/admin-end-shift", () => ({
  adminEndShift: jest.fn(),
  getAdminEndShiftPreview: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/tracking/shifts/[id]/admin-end/route";
import { withAuth } from "@/lib/auth-middleware";
import {
  adminEndShift,
  getAdminEndShiftPreview,
} from "@/services/tracking/admin-end-shift";

const mockWithAuth = withAuth as jest.Mock;
const mockAdminEndShift = adminEndShift as jest.Mock;
const mockPreview = getAdminEndShiftPreview as jest.Mock;

const SHIFT_ID = "660e8400-e29b-41d4-a716-446655440001";
const URL = `http://localhost:3000/api/tracking/shifts/${SHIFT_ID}/admin-end`;
const params = (id = SHIFT_ID) => ({ params: Promise.resolve({ id }) });

function authAs(type: string | null, id = "admin-1") {
  mockWithAuth.mockImplementation(async (_req, options) => {
    if (type === null) {
      return {
        success: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
        context: {},
      };
    }
    if (!(options?.allowedRoles ?? []).includes(type)) {
      return {
        success: false,
        response: new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
        }),
        context: {},
      };
    }
    return {
      success: true,
      context: { user: { id, email: `${id}@example.com`, type } },
    };
  });
}

function post(body: unknown): NextRequest {
  return new NextRequest(URL, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/tracking/shifts/[id]/admin-end", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminEndShift.mockResolvedValue({
      ok: true,
      shiftId: SHIFT_ID,
      voidedReturnRequests: 0,
    });
  });

  it("rejects unauthenticated callers with 401", async () => {
    authAs(null);
    const res = await POST(post({ reason: "Stuck shift" }), params());
    expect(res.status).toBe(401);
    expect(mockAdminEndShift).not.toHaveBeenCalled();
  });

  it.each(["DRIVER", "HELPDESK", "CLIENT"])(
    "rejects %s with 403",
    async (role) => {
      authAs(role);
      const res = await POST(post({ reason: "Stuck shift" }), params());
      expect(res.status).toBe(403);
      expect(mockAdminEndShift).not.toHaveBeenCalled();
    },
  );

  it("only allows ADMIN and SUPER_ADMIN", async () => {
    authAs("ADMIN");
    await POST(post({ reason: "Stuck shift" }), params());
    expect(mockWithAuth.mock.calls[0][1].allowedRoles).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  it.each([{}, { reason: "" }, { reason: "   " }, { reason: "ab" }])(
    "requires a reason (%p → 400)",
    async (body) => {
      authAs("ADMIN");
      const res = await POST(post(body), params());
      expect(res.status).toBe(400);
      expect(mockAdminEndShift).not.toHaveBeenCalled();
    },
  );

  it("rejects a malformed shift id with 400", async () => {
    authAs("ADMIN");
    const res = await POST(
      post({ reason: "Stuck shift" }),
      params("not-a-uuid"),
    );
    expect(res.status).toBe(400);
  });

  it("ends the shift as the authenticated admin", async () => {
    authAs("SUPER_ADMIN", "admin-9");
    const res = await POST(
      post({ reason: "Driver phone died", voidReturnRequests: true }),
      params(),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      shiftId: SHIFT_ID,
      voidedReturnRequests: 0,
    });
    expect(mockAdminEndShift).toHaveBeenCalledWith({
      shiftId: SHIFT_ID,
      reason: "Driver phone died",
      voidReturnRequests: true,
      actor: { id: "admin-9", email: "admin-9@example.com" },
    });
  });

  it("returns 409 when the shift has already ended", async () => {
    authAs("ADMIN");
    mockAdminEndShift.mockResolvedValueOnce({
      ok: false,
      code: "ALREADY_ENDED",
      error: "This shift has already ended.",
    });
    const res = await POST(post({ reason: "Stuck shift" }), params());
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown shift", async () => {
    authAs("ADMIN");
    mockAdminEndShift.mockResolvedValueOnce({
      ok: false,
      code: "NOT_FOUND",
      error: "Shift not found",
    });
    const res = await POST(post({ reason: "Stuck shift" }), params());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/tracking/shifts/[id]/admin-end", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non-admins with 403", async () => {
    authAs("DRIVER");
    const res = await GET(new NextRequest(URL), params());
    expect(res.status).toBe(403);
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("returns the preview for an admin", async () => {
    authAs("ADMIN");
    const preview = {
      shift: { id: SHIFT_ID },
      openOrders: [],
      pendingReturnRequests: [],
    };
    mockPreview.mockResolvedValueOnce(preview);
    const res = await GET(new NextRequest(URL), params());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, data: preview });
  });

  it("returns 404 for an unknown shift", async () => {
    authAs("ADMIN");
    mockPreview.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest(URL), params());
    expect(res.status).toBe(404);
  });
});
