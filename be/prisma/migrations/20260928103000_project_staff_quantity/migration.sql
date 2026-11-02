-- DropForeignKey
ALTER TABLE "project_assignments" DROP CONSTRAINT IF EXISTS "project_assignments_employeeId_fkey";

-- AlterTable
ALTER TABLE "project_assignments" DROP COLUMN IF EXISTS "employeeId";
ALTER TABLE "project_assignments" DROP COLUMN IF EXISTS "monthlySalary";
ALTER TABLE "project_assignments" DROP COLUMN IF EXISTS "isPrimary";
ALTER TABLE "project_assignments" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX IF EXISTS "project_assignments_employeeId_idx";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_assignments_projectId_role_key" ON "project_assignments"("projectId", "role");

-- AlterTable employees
ALTER TABLE "employees" DROP COLUMN IF EXISTS "monthlySalary";
