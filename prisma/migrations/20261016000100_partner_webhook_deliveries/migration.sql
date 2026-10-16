-- Durable outbound partner webhook queue (card catercow-durable-webhook-retry).
-- One row per partner lifecycle event recorded in order_status_history. The
-- dispatcher enqueues and makes the first attempt in-request; failures are
-- retried by the /api/admin/partner-webhook-retry cron worker until the 5th
-- attempt (~30 min), then marked FAILED. status_history_id is UNIQUE so
-- enqueueing the same event twice is a no-op. Both order FKs cascade so the
-- order purge job (which hard-deletes catering_requests) keeps working.
-- Additive only: new enum + new table, nothing existing is altered.
-- CreateEnum
CREATE TYPE "public"."PartnerWebhookDeliveryState" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."partner_webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "catering_request_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "status_history_id" UUID,
    "event_status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "public"."PartnerWebhookDeliveryState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6),
    "last_attempt_at" TIMESTAMPTZ(6),
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_webhook_deliveries_status_history_id_key" ON "public"."partner_webhook_deliveries"("status_history_id");

-- CreateIndex
CREATE INDEX "partner_webhook_deliveries_state_next_attempt_at_idx" ON "public"."partner_webhook_deliveries"("state", "next_attempt_at");

-- CreateIndex
CREATE INDEX "partner_webhook_deliveries_catering_request_id_idx" ON "public"."partner_webhook_deliveries"("catering_request_id");

-- CreateIndex
CREATE INDEX "partner_webhook_deliveries_partner_id_idx" ON "public"."partner_webhook_deliveries"("partner_id");

-- AddForeignKey
ALTER TABLE "public"."partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."api_partners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_catering_request_id_fkey" FOREIGN KEY ("catering_request_id") REFERENCES "public"."catering_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_status_history_id_fkey" FOREIGN KEY ("status_history_id") REFERENCES "public"."order_status_history"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- Supabase exposes the public schema via PostgREST; RLS with no policies
-- blocks anon/authenticated direct DML (the table holds signed payload
-- bodies) while Prisma (service role / owner) is unaffected. Matches the
-- order_status_history / delivery_return_requests posture.
ALTER TABLE "public"."partner_webhook_deliveries" ENABLE ROW LEVEL SECURITY;
