-- Replace generic legal-form contract categories with operational categories.
CREATE TYPE "ContractType_new" AS ENUM ('MAINTENANCE', 'OPERATION', 'REPAIR', 'PROJECT');

ALTER TABLE "contracts"
  ALTER COLUMN "contractType" DROP DEFAULT,
  ALTER COLUMN "contractType" TYPE "ContractType_new"
  USING (
    CASE "contractType"::text
      WHEN 'SERVICE' THEN 'MAINTENANCE'
      WHEN 'MAIN' THEN 'PROJECT'
      WHEN 'APPENDIX' THEN 'PROJECT'
      WHEN 'OTHER' THEN 'PROJECT'
    END
  )::"ContractType_new";

DROP TYPE "ContractType";
ALTER TYPE "ContractType_new" RENAME TO "ContractType";
ALTER TABLE "contracts"
  ALTER COLUMN "contractType" SET DEFAULT 'PROJECT'::"ContractType";
