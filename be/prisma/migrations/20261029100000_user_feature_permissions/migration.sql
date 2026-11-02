-- CreateEnum
CREATE TYPE "UserAccessMode" AS ENUM ('FULL', 'LIMITED');

-- AlterTable
ALTER TABLE "app_users" ADD COLUMN     "access_mode" "UserAccessMode" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

