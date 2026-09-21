// src/lib/services/catering-order-filters.ts

import { CateringStatus, CateringRequestWhereInput } from "@/types/prisma";

/**
 * Status groupings behind the admin catering-order tabs.
 *
 * These used to be an if/else chain inside
 * `src/app/api/orders/catering-orders/route.ts`, which made them impossible to
 * unit test and left "All Open" with no date bound at all — the reason prod
 * accumulated 229 never-confirmed CaterValley drafts in that tab
 * (old-orders audit, JOURNAL 2026-09-14).
 */

/** Every status an order can hold while it is still open (not completed/cancelled). */
export const OPEN_CATERING_STATUSES = [
  CateringStatus.PENDING,
  CateringStatus.CONFIRMED,
  CateringStatus.ACTIVE,
  CateringStatus.ASSIGNED,
  CateringStatus.IN_PROGRESS,
  CateringStatus.DELIVERED,
] as const;

/** Legacy "active" grouping kept for the dashboard's `statusFilter=active` call. */
export const ACTIVE_CATERING_STATUSES = [
  CateringStatus.ACTIVE,
  CateringStatus.ASSIGNED,
  CateringStatus.PENDING,
  CateringStatus.CONFIRMED,
  CateringStatus.IN_PROGRESS,
] as const;

/** Orders awaiting processing. */
export const NEW_CATERING_STATUSES = [
  CateringStatus.PENDING,
  CateringStatus.CONFIRMED,
] as const;

/** Orders already being worked on. */
export const IN_TRANSIT_CATERING_STATUSES = [
  CateringStatus.ACTIVE,
  CateringStatus.ASSIGNED,
  CateringStatus.IN_PROGRESS,
  CateringStatus.DELIVERED,
] as const;

/**
 * How long after its pickup time an open order is still considered normal.
 *
 * A delivery is routinely worked minutes or hours past its pickup slot, so a
 * bare `pickupDateTime < now` would flag healthy same-day orders. A day of
 * grace isolates the genuinely stale ones without hiding today's problems.
 */
export const OVERDUE_GRACE_HOURS = 24;

export type CateringStatusTab =
  | "active"
  | "all_open"
  | "new"
  | "in_transit"
  | "overdue";

/**
 * Translate a status tab into a Prisma `where` fragment.
 *
 * Returns `null` when the tab is absent or unrecognised, so the caller can
 * fall back to its own handling (e.g. a single `status=` parameter).
 *
 * Note: `overdue` compares `pickupDateTime`, so orders with no pickup time
 * recorded are never reported as overdue — there is nothing to be late for.
 */
export function buildCateringStatusTabWhere(
  tab: string | null | undefined,
  now: Date = new Date(),
): CateringRequestWhereInput | null {
  switch (tab) {
    case "active":
      return { status: { in: [...ACTIVE_CATERING_STATUSES] } };
    case "all_open":
      return { status: { in: [...OPEN_CATERING_STATUSES] } };
    case "new":
      return { status: { in: [...NEW_CATERING_STATUSES] } };
    case "in_transit":
      return { status: { in: [...IN_TRANSIT_CATERING_STATUSES] } };
    case "overdue":
      return {
        status: { in: [...OPEN_CATERING_STATUSES] },
        pickupDateTime: {
          lt: new Date(now.getTime() - OVERDUE_GRACE_HOURS * 60 * 60 * 1000),
        },
      };
    default:
      return null;
  }
}
