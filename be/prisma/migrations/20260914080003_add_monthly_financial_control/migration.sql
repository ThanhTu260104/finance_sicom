-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "collectionNo" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "collectionDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_monthly_financials" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "actualWorkAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_monthly_financials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_contractId_idx" ON "collections"("contractId");

-- CreateIndex
CREATE INDEX "collections_period_idx" ON "collections"("period");

-- CreateIndex
CREATE INDEX "collections_collectionNo_idx" ON "collections"("collectionNo");

-- CreateIndex
CREATE INDEX "contract_monthly_financials_contractId_idx" ON "contract_monthly_financials"("contractId");

-- CreateIndex
CREATE INDEX "contract_monthly_financials_period_idx" ON "contract_monthly_financials"("period");

-- CreateIndex
CREATE UNIQUE INDEX "contract_monthly_financials_contractId_period_key" ON "contract_monthly_financials"("contractId", "period");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_monthly_financials" ADD CONSTRAINT "contract_monthly_financials_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
