-- CreateEnum
CREATE TYPE "ProjectOperatingCostCategory" AS ENUM (
  'OPERATING',
  'SOFTWARE_INSURANCE',
  'TOOLS_CONSUMABLES',
  'DOCUMENTATION',
  'SUBCONTRACTOR_TAX',
  'OTHER'
);

-- CreateTable
CREATE TABLE "project_operating_costs" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "category" "ProjectOperatingCostCategory" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_operating_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_operating_costs_projectId_category_key" ON "project_operating_costs"("projectId", "category");
CREATE INDEX "project_operating_costs_projectId_idx" ON "project_operating_costs"("projectId");

-- AddForeignKey
ALTER TABLE "project_operating_costs" ADD CONSTRAINT "project_operating_costs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
