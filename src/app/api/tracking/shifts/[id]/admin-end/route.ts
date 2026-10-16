/**
 * Admin "End shift" for a driver's stuck shift (/admin/tracking).
 *
 * GET  — preview: the shift, orders still assigned to the driver, and this
 *        shift's PENDING return requests. Feeds the confirmation dialog.
 * POST — { reason, voidReturnRequests? } closes the shift (force past the
 *        end-shift guard), optionally voids those return requests, and audits
 *        who/when/why. Orders are never cancelled — see admin-end-shift.ts.
 *
 * ADMIN / SUPER_ADMIN only (same as the tracking settings PUT).
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { withAuth } from "@/lib/auth-middleware";
import {
  adminEndShift,
  getAdminEndShiftPreview,
} from "@/services/tracking/admin-end-shift";
import { AdminEndShiftRequestSchema } from "@/types/admin-end-shift";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type RouteContext = { params: Promise<{ id: string }> };

const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  ALREADY_ENDED: 409,
  END_FAILED: 500,
} as const;

function invalidShiftId() {
  return NextResponse.json(
    { success: false, error: "Invalid shift id" },
    { status: 400 },
  );
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await withAuth(request, {
    allowedRoles: ADMIN_ROLES,
    requireAuth: true,
  });
  if (!auth.success) return auth.response;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return invalidShiftId();

  try {
    const preview = await getAdminEndShiftPreview(id);
    if (!preview) {
      return NextResponse.json(
        { success: false, error: "Shift not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    console.error("Error loading admin end-shift preview:", error);
    Sentry.captureException(error, { tags: { component: "admin-shift-end" } });
    return NextResponse.json(
      { success: false, error: "Failed to load shift details" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await withAuth(request, {
    allowedRoles: ADMIN_ROLES,
    requireAuth: true,
  });
  if (!auth.success) return auth.response;
  const { user } = auth.context;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return invalidShiftId();

  const parsed = AdminEndShiftRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      },
      { status: 400 },
    );
  }

  try {
    const result = await adminEndShift({
      shiftId: id,
      reason: parsed.data.reason,
      voidReturnRequests: parsed.data.voidReturnRequests,
      actor: { id: user.id, email: user.email },
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: STATUS_BY_CODE[result.code] },
      );
    }
    const { ok: _ok, ...body } = result;
    return NextResponse.json({ success: true, ...body });
  } catch (error) {
    console.error("Error ending shift as admin:", error);
    Sentry.captureException(error, { tags: { component: "admin-shift-end" } });
    return NextResponse.json(
      { success: false, error: "Failed to end shift" },
      { status: 500 },
    );
  }
}
