-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "pricing_tiers" JSONB NOT NULL,
    "mileage_rate" DECIMAL(10,2) NOT NULL,
    "distance_threshold" DECIMAL(5,2) NOT NULL,
    "daily_drive_discounts" JSONB NOT NULL,
    "driver_pay_settings" JSONB NOT NULL,
    "bridge_toll_settings" JSONB NOT NULL,
    "custom_settings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "notes" TEXT,

    CONSTRAINT "delivery_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_configurations_config_id_key" ON "delivery_configurations"("config_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_configurations_config_id_idx" ON "delivery_configurations"("config_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_configurations_is_active_idx" ON "delivery_configurations"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "delivery_configurations_client_name_idx" ON "delivery_configurations"("client_name");
