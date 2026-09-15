-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "revenue_plans" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "plannedAmount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptances" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "acceptanceNo" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "acceptanceDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "AcceptanceStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_plans_contractId_idx" ON "revenue_plans"("contractId");

-- CreateIndex
CREATE INDEX "revenue_plans_period_idx" ON "revenue_plans"("period");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_plans_contractId_period_key" ON "revenue_plans"("contractId", "period");

-- CreateIndex
CREATE INDEX "acceptances_contractId_idx" ON "acceptances"("contractId");

-- CreateIndex
CREATE INDEX "acceptances_period_idx" ON "acceptances"("period");

-- CreateIndex
CREATE INDEX "acceptances_status_idx" ON "acceptances"("status");

-- CreateIndex
CREATE INDEX "acceptances_acceptanceNo_idx" ON "acceptances"("acceptanceNo");

-- AddForeignKey
ALTER TABLE "revenue_plans" ADD CONSTRAINT "revenue_plans_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
