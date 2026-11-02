-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('INVESTOR', 'SUBCONTRACTOR', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('INVESTOR', 'SUBCONTRACTOR', 'SUPPLIER');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "company_id" UUID,
ADD COLUMN     "counterparty_id" UUID,
ADD COLUMN     "kind" "ContractKind" NOT NULL DEFAULT 'INVESTOR';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "partner_types" "PartnerType"[] DEFAULT ARRAY['INVESTOR']::"PartnerType"[];

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxCode" TEXT,
    "address" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "contracts_kind_idx" ON "contracts"("kind");

-- CreateIndex
CREATE INDEX "contracts_company_id_idx" ON "contracts"("company_id");

-- CreateIndex
CREATE INDEX "contracts_counterparty_id_idx" ON "contracts"("counterparty_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

