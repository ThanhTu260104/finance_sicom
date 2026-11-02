-- AlterEnum
CREATE TYPE "AcceptanceAttachmentKind" AS ENUM ('MINUTES', 'VOLUME', 'INVOICE');

-- CreateTable
CREATE TABLE "acceptance_attachments" (
    "id" UUID NOT NULL,
    "acceptanceId" UUID NOT NULL,
    "kind" "AcceptanceAttachmentKind" NOT NULL DEFAULT 'MINUTES',
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "acceptance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acceptance_attachments_acceptanceId_idx" ON "acceptance_attachments"("acceptanceId");

-- CreateIndex
CREATE INDEX "acceptance_attachments_kind_idx" ON "acceptance_attachments"("kind");

-- AddForeignKey
ALTER TABLE "acceptance_attachments" ADD CONSTRAINT "acceptance_attachments_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "acceptances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
