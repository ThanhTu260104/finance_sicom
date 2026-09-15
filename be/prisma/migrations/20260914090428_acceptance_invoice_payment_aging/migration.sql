-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED_UNPAID');

-- CreateEnum
CREATE TYPE "AcceptancePaymentStatus" AS ENUM ('NOT_ACCEPTED', 'WAITING_CLIENT_PAYMENT', 'COLLECTED');

-- AlterTable
ALTER TABLE "acceptances" ADD COLUMN     "documentStatus" "DocumentStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "paymentStatus" "AcceptancePaymentStatus" NOT NULL DEFAULT 'NOT_ACCEPTED';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "paymentTermDays" INTEGER NOT NULL DEFAULT 60;

-- CreateIndex
CREATE INDEX "acceptances_documentStatus_idx" ON "acceptances"("documentStatus");

-- CreateIndex
CREATE INDEX "acceptances_paymentStatus_idx" ON "acceptances"("paymentStatus");
