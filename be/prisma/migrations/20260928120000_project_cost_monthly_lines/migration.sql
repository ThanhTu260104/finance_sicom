-- DropIndex
DROP INDEX IF EXISTS "project_operating_costs_projectId_category_key";

-- AlterTable
ALTER TABLE "project_operating_costs" ADD COLUMN IF NOT EXISTS "period" TEXT;
ALTER TABLE "project_operating_costs" ADD COLUMN IF NOT EXISTS "title" TEXT;

UPDATE "project_operating_costs"
SET "period" = to_char(CURRENT_DATE, 'YYYY-MM')
WHERE "period" IS NULL OR "period" = '';

ALTER TABLE "project_operating_costs" ALTER COLUMN "period" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_operating_costs_projectId_period_idx" ON "project_operating_costs"("projectId", "period");

-- Enum: chi phí nhân sự (tiền)
ALTER TYPE "ProjectOperatingCostCategory" ADD VALUE IF NOT EXISTS 'PERSONNEL';
