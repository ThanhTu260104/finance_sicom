-- CreateEnum
CREATE TYPE "ProjectReportStagedFileStatus" AS ENUM ('PENDING', 'UPLOADED');

-- CreateTable
CREATE TABLE "project_report_staged_files" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "expectedSizeBytes" INTEGER NOT NULL,
    "sizeBytes" INTEGER,
    "status" "ProjectReportStagedFileStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_report_staged_files_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_report_staged_files_expiresAt_idx" ON "project_report_staged_files"("expiresAt");
