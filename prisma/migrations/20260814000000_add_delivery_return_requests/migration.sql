-- Driver-initiated return-to-dispatch requests awaiting helpdesk/admin review
-- (follow-up to the #508 escape hatch). A driver return no longer unwinds the
-- assignment directly: it lands here as PENDING until a dispatcher approves
-- (executes the return), rejects, or the request auto-voids when the driver
-- advances the order past pickup. Privileged callers (ADMIN / SUPER_ADMIN /
-- HELPDESK) keep the immediate return and never create a row here.
CREATE TYPE "public"."ReturnRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'VOIDED');

CREATE TABLE IF NOT EXISTS "public"."delivery_return_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_type" VARCHAR(20) NOT NULL,
    "order_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "driver_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "public"."ReturnRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT "delivery_return_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_return_requests_status_idx"
  ON "public"."delivery_return_requests"("status");
CREATE INDEX "delivery_return_requests_order_id_status_idx"
  ON "public"."delivery_return_requests"("order_id", "status");
CREATE INDEX "delivery_return_requests_driver_id_status_idx"
  ON "public"."delivery_return_requests"("driver_id", "status");

-- At most one PENDING request per order. Partial indexes are not expressible
-- in the Prisma schema, so this constraint lives here only; application code
-- treats the resulting unique violation as "return the existing request".
CREATE UNIQUE INDEX "delivery_return_requests_one_pending_per_order"
  ON "public"."delivery_return_requests"("order_id")
  WHERE "status" = 'PENDING';

-- Supabase exposes the public schema via PostgREST; RLS with no policies
-- blocks anon/authenticated direct DML while Prisma (service role / owner)
-- is unaffected. Matches the tracking_settings / order_status_history posture.
ALTER TABLE "public"."delivery_return_requests" ENABLE ROW LEVEL SECURITY;
