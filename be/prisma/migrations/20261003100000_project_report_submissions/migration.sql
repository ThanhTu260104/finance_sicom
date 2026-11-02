-- CreateEnum
CREATE TYPE "ProjectReportSubmissionStatus" AS ENUM ('SUBMITTED');

-- CreateEnum
CREATE TYPE "ProjectReportFileStorage" AS ENUM ('LOCAL', 'GOOGLE_DRIVE');

-- CreateTable
CREATE TABLE "project_report_submissions" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "title" TEXT,
    "note" TEXT,
    "status" "ProjectReportSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_report_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_report_submission_lines" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "contractNo" TEXT NOT NULL,
    "contractName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reportedPlannedAmount" DECIMAL(18,2) NOT NULL,
    "systemPlannedAmountSnapshot" DECIMAL(18,2),
    "note" TEXT,

    CONSTRAINT "project_report_submission_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_report_submission_files" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storage" "ProjectReportFileStorage" NOT NULL DEFAULT 'LOCAL',
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_report_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_report_submissions_projectId_period_idx" ON "project_report_submissions"("projectId", "period");

-- CreateIndex
CREATE INDEX "project_report_submissions_projectId_idx" ON "project_report_submissions"("projectId");

-- CreateIndex
CREATE INDEX "project_report_submission_lines_submissionId_idx" ON "project_report_submission_lines"("submissionId");

-- CreateIndex
CREATE INDEX "project_report_submission_lines_contractId_idx" ON "project_report_submission_lines"("contractId");

-- CreateIndex
CREATE INDEX "project_report_submission_files_submissionId_idx" ON "project_report_submission_files"("submissionId");

-- AddForeignKey
ALTER TABLE "project_report_submissions" ADD CONSTRAINT "project_report_submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_report_submission_lines" ADD CONSTRAINT "project_report_submission_lines_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "project_report_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_report_submission_lines" ADD CONSTRAINT "project_report_submission_lines_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_report_submission_files" ADD CONSTRAINT "project_report_submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "project_report_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
