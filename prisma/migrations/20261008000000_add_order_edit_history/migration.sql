-- Additive migration: append-only audit log of customer-initiated edits
-- (headcount, orderTotal) on catering orders. One row per changed field.
-- `edited_by` is a plain UUID with no foreign key so the row survives a
-- hard-deleted profile (same posture as order_status_history.changed_by).

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_edit_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catering_request_id" UUID NOT NULL,
    "edited_by" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_edit_history_catering_request_id_created_at_idx" ON "order_edit_history"("catering_request_id", "created_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_edit_history_catering_request_id_fkey'
    ) THEN
        ALTER TABLE "order_edit_history"
            ADD CONSTRAINT "order_edit_history_catering_request_id_fkey"
            FOREIGN KEY ("catering_request_id") REFERENCES "catering_requests"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Enable Row-Level Security with no policies. This table is only ever
-- read/written server-side via Prisma (service_role). RLS with no
-- policies makes it inaccessible from anon / authenticated roles,
-- matching the posture of order_status_history.
ALTER TABLE "order_edit_history" ENABLE ROW LEVEL SECURITY;
