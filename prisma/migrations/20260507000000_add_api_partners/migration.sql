-- CreateTable
CREATE TABLE IF NOT EXISTS "api_partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "order_prefix" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "api_key_last_four" VARCHAR(4) NOT NULL,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,

    CONSTRAINT "api_partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "api_partners_slug_key" ON "api_partners"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_partners_api_key_hash_idx" ON "api_partners"("api_key_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_partners_slug_deleted_at_idx" ON "api_partners"("slug", "deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_partners_deleted_at_idx" ON "api_partners"("deleted_at");

-- Enable Row-Level Security with no policies. The table holds hashed
-- inbound API keys and outbound HMAC webhook secrets — only the
-- service_role (used by Prisma server-side) should ever read it. RLS
-- with no policies makes the table inaccessible from anon /
-- authenticated roles, defending against an accidental client-side
-- query path.
ALTER TABLE "api_partners" ENABLE ROW LEVEL SECURITY;
