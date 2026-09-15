-- CreateEnum
CREATE TYPE "ContractAttachmentKind" AS ENUM ('CONTRACT', 'APPENDIX', 'OTHER');

-- CreateTable
CREATE TABLE "contract_attachments" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "kind" "ContractAttachmentKind" NOT NULL DEFAULT 'CONTRACT',
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contract_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_attachments_contractId_idx" ON "contract_attachments"("contractId");

-- CreateIndex
CREATE INDEX "contract_attachments_kind_idx" ON "contract_attachments"("kind");

-- AddForeignKey
ALTER TABLE "contract_attachments" ADD CONSTRAINT "contract_attachments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
