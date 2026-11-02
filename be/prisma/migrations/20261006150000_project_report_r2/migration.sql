-- AlterEnum
ALTER TYPE "ProjectReportFileStorage" ADD VALUE 'R2';

-- CreateEnum
CREATE TYPE "ProjectReportStagedUploadTarget" AS ENUM ('LOCAL', 'R2');

-- AlterTable
ALTER TABLE "project_report_staged_files" ADD COLUMN "uploadTarget" "ProjectReportStagedUploadTarget" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "project_report_staged_files" ADD COLUMN "objectKey" TEXT;
