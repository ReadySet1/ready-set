-- CreateTable
CREATE TABLE IF NOT EXISTS "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "catering_request_id" UUID NOT NULL,
    "partner_status" TEXT NOT NULL,
    "driver_status" "DriverStatus",
    "changed_by" UUID,
    "location" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_status_history_catering_request_id_created_at_idx" ON "order_status_history"("catering_request_id", "created_at");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_status_history_catering_request_id_fkey'
    ) THEN
        ALTER TABLE "order_status_history"
            ADD CONSTRAINT "order_status_history_catering_request_id_fkey"
            FOREIGN KEY ("catering_request_id") REFERENCES "catering_requests"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Enable Row-Level Security with no policies. This table is only ever
-- read/written server-side via Prisma (service_role) — the partner
-- GET /orders/{id} endpoint and the outbound webhook dispatcher. RLS
-- with no policies makes it inaccessible from anon / authenticated
-- roles, matching the posture of api_partners.
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
