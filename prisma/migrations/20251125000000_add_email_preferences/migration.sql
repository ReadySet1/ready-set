-- CreateTable
CREATE TABLE "public"."email_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "delivery_notifications" BOOLEAN NOT NULL DEFAULT true,
    "promotional_emails" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_preferences_user_id_key" ON "public"."email_preferences"("user_id");

-- CreateIndex
CREATE INDEX "email_preferences_user_id_idx" ON "public"."email_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "public"."email_preferences" ADD CONSTRAINT "email_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
