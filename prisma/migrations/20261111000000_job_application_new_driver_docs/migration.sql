-- New optional driver documents (REA-111126). Additive only: nullable columns,
-- no drops, no backfill, so existing job applications stay valid.

-- AlterTable
ALTER TABLE "job_applications" ADD COLUMN     "secondIdFilePath" TEXT,
ADD COLUMN     "cateringBagsPhotoFilePath" TEXT,
ADD COLUMN     "cartDollyPhotoFilePath" TEXT;
