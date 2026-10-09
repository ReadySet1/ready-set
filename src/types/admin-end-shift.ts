import { z } from "zod";

/**
 * Admin "End shift" — shared request schema and response shapes for
 * GET/POST /api/tracking/shifts/[id]/admin-end. Client-safe (no server deps).
 */

export const ADMIN_END_SHIFT_REASON_MIN = 3;
export const ADMIN_END_SHIFT_REASON_MAX = 500;

export const AdminEndShiftRequestSchema = z.object({
  reason: z
    .string({ error: "A reason is required" })
    .trim()
    .min(ADMIN_END_SHIFT_REASON_MIN, "A reason is required")
    .max(ADMIN_END_SHIFT_REASON_MAX),
  /** Opt-in: void this shift's PENDING return requests. Default: leave them for review. */
  voidReturnRequests: z.boolean().optional().default(false),
});

export type AdminEndShiftRequest = z.infer<typeof AdminEndShiftRequestSchema>;

/** An order still assigned to the driver. Ending the shift never changes it. */
export interface AdminEndShiftOpenOrder {
  orderNumber: string;
  status: string;
  /**
   * True when the driver's own End Shift guard will refuse their NEXT shift
   * over this order: it is started work (mid-delivery), which blocks with no
   * date window until dispatch reassigns, completes or cancels it.
   * Not-started work is false (it stops blocking 24h after its pickup).
   */
  blocksNextEndShift: boolean;
}

export interface AdminEndShiftReturnRequest {
  id: string;
  orderNumber: string;
  reason: string;
  requestedAt: string;
}

export interface AdminEndShiftPreview {
  shift: {
    id: string;
    status: string;
    /** active or paused — anything else is already ended. */
    isOpen: boolean;
    shiftStart: string;
    driverId: string;
    driverName: string | null;
  };
  openOrders: AdminEndShiftOpenOrder[];
  /** PENDING return requests the driver filed during this shift. */
  pendingReturnRequests: AdminEndShiftReturnRequest[];
}
