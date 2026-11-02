-- CreateTable
CREATE TABLE "cost_categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cost_categories_code_key" ON "cost_categories"("code");
CREATE INDEX "cost_categories_status_idx" ON "cost_categories"("status");

INSERT INTO "cost_categories" ("id", "code", "name", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid(), 'PERSONNEL', 'Chi phí nhân sự', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OPERATING', 'Chi phí vận hành', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SOFTWARE_INSURANCE', 'Chi phí phần mềm / bảo hiểm', 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'TOOLS_CONSUMABLES', 'Công cụ, dụng cụ, vật tư tiêu hao', 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'DOCUMENTATION', 'Chi phí hồ sơ', 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SUBCONTRACTOR_TAX', 'Chi phí nhà thầu phụ, thuế doanh nghiệp', 60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'OTHER', 'Chi phí khác', 90, CURRENT_TIMESTAMP);

ALTER TABLE "project_operating_costs" ADD COLUMN "categoryId" UUID;

UPDATE "project_operating_costs" AS poc
SET "categoryId" = cc."id"
FROM "cost_categories" AS cc
WHERE cc."code" = poc."category"::text;

UPDATE "project_operating_costs"
SET "categoryId" = (SELECT "id" FROM "cost_categories" WHERE "code" = 'OTHER' LIMIT 1)
WHERE "categoryId" IS NULL;

ALTER TABLE "project_operating_costs" DROP COLUMN "category";
ALTER TABLE "project_operating_costs" ALTER COLUMN "categoryId" SET NOT NULL;

ALTER TABLE "project_operating_costs" ADD CONSTRAINT "project_operating_costs_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "cost_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "project_operating_costs_categoryId_idx" ON "project_operating_costs"("categoryId");

DROP TYPE IF EXISTS "ProjectOperatingCostCategory";
