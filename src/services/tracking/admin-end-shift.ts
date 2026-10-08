/**
 * Admin "End shift" — close a driver's stuck shift from /admin/tracking.
 *
 * The shift close itself is `endDriverShift` with `force: true` (the same
 * path the old curl workaround used): it skips the end-shift guard, records
 * mileage and releases the driver row. This module adds what an admin needs
 * around it: a preview of what is still open, the required reason, an
 * optional void of this shift's pending return requests, and an audit row.
 *
 * Semantics (see PR "admin end shift"):
 *  - Orders and `deliveries` rows are never touched. The guard only blocks a
 *    driver's own End Shift; an admin close bypasses it, so nothing has to be
 *    cancelled to unstick the shift. Open orders stay assigned to the driver
 *    and are shown so dispatch can reassign them deliberately.
 *  - PENDING return requests never block End Shift and are dispatch's queue,
 *    so they are left for review unless the admin explicitly opts in to void
 *    them (e.g. test-drive cleanup).
 */

import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/utils/prismaDB";
import { endDriverShift } from "@/app/actions/tracking/driver-actions";
import { AuditAction } from "@/types/audit";
import type {
  AdminEndShiftOpenOrder,
  AdminEndShiftPreview,
} from "@/types/admin-end-shift";

const OPEN_SHIFT_STATUSES = ["active", "paused"];

interface ShiftContextRow {
  id: string;
  status: string;
  shift_start: Date;
  driver_id: string;
  profile_id: string | null;
  driver_name: string | null;
}

/**
 * The shift plus its driver. The driver row is deliberately not filtered on
 * `deleted_at`: a soft-deleted driver's stuck shift must still be closable.
 */
async function loadShiftContext(
  shiftId: string,
): Promise<ShiftContextRow | null> {
  const rows = await prisma.$queryRawUnsafe<ShiftContextRow[]>(
    `
    SELECT
      ds.id,
      ds.status,
      ds.shift_start,
      ds.driver_id,
      d.profile_id,
      p.name AS driver_name
    FROM driver_shifts ds
    JOIN drivers d ON d.id = ds.driver_id
    LEFT JOIN profiles p ON p.id = d.profile_id
    WHERE ds.id = $1::uuid
      AND ds.deleted_at IS NULL
    LIMIT 1
  `,
    shiftId,
  );
  return rows[0] ?? null;
}

/**
 * Every non-terminal order still assigned to the driver, from both places the
 * end-shift guard looks: the `deliveries` mirror (keyed on drivers.id) and
 * dispatches (keyed on the driver's profile id). Deduped by order number.
 */
async function loadOpenOrders(
  driverId: string,
): Promise<AdminEndShiftOpenOrder[]> {
  const rows = await prisma.$queryRawUnsafe<
    { order_number: string | null; status: string | null }[]
  >(
    `
    SELECT dl.order_number, dl.status
    FROM deliveries dl
    WHERE dl.driver_id = $1::uuid
      AND dl.deleted_at IS NULL
      AND UPPER(dl.status) NOT IN ('COMPLETED','CANCELLED','DELIVERED')
    UNION ALL
    SELECT
      COALESCE(cr."orderNumber", od."orderNumber") AS order_number,
      COALESCE(cr."driverStatus"::text, od."driverStatus"::text,
               cr.status::text, od.status::text) AS status
    FROM dispatches di
    LEFT JOIN catering_requests cr
      ON cr.id = di."cateringRequestId" AND cr."deletedAt" IS NULL
    LEFT JOIN on_demand_requests od
      ON od.id = di."onDemandId" AND od."deletedAt" IS NULL
    WHERE di."driverId" = (SELECT profile_id FROM drivers WHERE id = $1::uuid)
      AND (
        (cr.id IS NOT NULL AND cr.status NOT IN ('COMPLETED','CANCELLED','DELIVERED'))
        OR (od.id IS NOT NULL AND od.status NOT IN ('COMPLETED','CANCELLED','DELIVERED'))
      )
  `,
    driverId,
  );

  const seen = new Set<string>();
  const orders: AdminEndShiftOpenOrder[] = [];
  for (const row of rows) {
    if (!row.order_number || seen.has(row.order_number)) continue;
    seen.add(row.order_number);
    orders.push({
      orderNumber: row.order_number,
      status: row.status ?? "UNKNOWN",
    });
  }
  return orders;
}

/** PENDING return requests are keyed on the driver's profile id. */
function pendingReturnRequestsWhere(shift: ShiftContextRow) {
  return {
    driverId: shift.profile_id as string,
    status: "PENDING" as const,
    requestedAt: { gte: shift.shift_start },
  };
}

/** What an admin sees before confirming. Null when the shift does not exist. */
export async function getAdminEndShiftPreview(
  shiftId: string,
): Promise<AdminEndShiftPreview | null> {
  const shift = await loadShiftContext(shiftId);
  if (!shift) return null;

  const [openOrders, pendingRequests] = await Promise.all([
    loadOpenOrders(shift.driver_id),
    shift.profile_id
      ? prisma.deliveryReturnRequest.findMany({
          where: pendingReturnRequestsWhere(shift),
          orderBy: { requestedAt: "asc" },
          select: {
            id: true,
            orderNumber: true,
            reason: true,
            requestedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    shift: {
      id: shift.id,
      status: shift.status,
      isOpen: OPEN_SHIFT_STATUSES.includes(shift.status),
      shiftStart: shift.shift_start.toISOString(),
      driverId: shift.driver_id,
      driverName: shift.driver_name,
    },
    openOrders,
    pendingReturnRequests: pendingRequests.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      reason: r.reason,
      requestedAt: r.requestedAt.toISOString(),
    })),
  };
}

export interface AdminEndShiftParams {
  shiftId: string;
  /** Already validated (trimmed, non-empty) by the caller. */
  reason: string;
  voidReturnRequests?: boolean;
  actor: { id: string; email?: string | null };
}

export type AdminEndShiftResult =
  | {
      ok: true;
      shiftId: string;
      voidedReturnRequests: number;
      warning?: string;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "ALREADY_ENDED" | "END_FAILED";
      error: string;
    };

const ALREADY_ENDED = "This shift has already ended.";

export async function adminEndShift(
  params: AdminEndShiftParams,
): Promise<AdminEndShiftResult> {
  const { shiftId, actor } = params;
  const reason = params.reason.trim();

  const shift = await loadShiftContext(shiftId);
  if (!shift) return { ok: false, code: "NOT_FOUND", error: "Shift not found" };
  if (!OPEN_SHIFT_STATUSES.includes(shift.status)) {
    return { ok: false, code: "ALREADY_ENDED", error: ALREADY_ENDED };
  }

  // Snapshot what is left open for the audit trail (read-only).
  const openOrders = await loadOpenOrders(shift.driver_id);

  const endedAt = new Date();
  const result = await endDriverShift(shiftId, null, undefined, {
    force: true,
    notes: `[Ended by admin ${actor.email ?? actor.id} at ${endedAt.toISOString()}: ${reason}]`,
  });
  if (!result.success) {
    // endDriverShift re-reads the shift; "not found" here means it was closed
    // between our lookup and the update (driver tapped End Shift meanwhile).
    if (result.error === "Active shift not found") {
      return { ok: false, code: "ALREADY_ENDED", error: ALREADY_ENDED };
    }
    return {
      ok: false,
      code: "END_FAILED",
      error: result.error ?? "Failed to end shift",
    };
  }

  const voidAndAudit = (): Promise<number> =>
    prisma.$transaction(async (tx) => {
      let voided = 0;
      if (params.voidReturnRequests && shift.profile_id) {
        const res = await tx.deliveryReturnRequest.updateMany({
          where: pendingReturnRequestsWhere(shift),
          data: {
            status: "VOIDED",
            resolvedAt: new Date(),
            resolvedBy: actor.id,
            resolutionNotes: `Voided when an admin ended the shift: ${reason}`,
          },
        });
        voided = res.count;
      }

      const metadata = {
        event: "ADMIN_SHIFT_END",
        shiftId,
        driverId: shift.driver_id,
        endedAt: endedAt.toISOString(),
        openOrders: openOrders.map((o) => o.orderNumber),
        voidedReturnRequests: voided,
      };
      // user_audits is keyed on a profile; a driver row with no profile link
      // still gets the log + breadcrumb below.
      if (shift.profile_id) {
        await tx.userAudit.create({
          data: {
            userId: shift.profile_id,
            action: AuditAction.STATUS_CHANGE,
            performedBy: actor.id,
            reason,
            changes: {
              before: { shiftStatus: shift.status },
              after: { shiftStatus: "completed" },
            },
            metadata,
          },
        });
      }

      const auditEntry = {
        action: "admin-shift-end",
        userId: actor.id,
        userEmail: actor.email,
        reason,
        ...metadata,
      };
      console.log(
        "[AUDIT] Admin ended driver shift:",
        JSON.stringify(auditEntry),
      );
      Sentry.addBreadcrumb({
        category: "admin-shift-end-audit",
        message: `Shift ${shiftId} ended by ${actor.email ?? actor.id}`,
        level: "info",
        data: auditEntry,
      });

      return voided;
    });

  // The shift is closed. Void (opt-in) and audit together; a failure here must
  // not read as "shift still open" (a retry would only 409), so it is reported
  // as a warning on an otherwise successful result.
  try {
    return { ok: true, shiftId, voidedReturnRequests: await voidAndAudit() };
  } catch (error) {
    console.error(
      "[AUDIT] Admin shift end: void/audit failed after the shift closed",
      error,
    );
    Sentry.captureException(error, {
      tags: { component: "admin-shift-end" },
      extra: { shiftId },
    });
    return {
      ok: true,
      shiftId,
      voidedReturnRequests: 0,
      warning:
        "The shift ended, but recording the audit or voiding return requests failed.",
    };
  }
}
