-- AlterTable: store multiple contract types as semicolon-separated string
ALTER TABLE "contracts" ALTER COLUMN "contractType" DROP DEFAULT;
ALTER TABLE "contracts"
  ALTER COLUMN "contractType" TYPE TEXT
  USING "contractType"::text;
ALTER TABLE "contracts" ALTER COLUMN "contractType" SET DEFAULT 'PROJECT';

DROP TYPE "ContractType";
