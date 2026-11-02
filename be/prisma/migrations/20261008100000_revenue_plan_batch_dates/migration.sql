-- Kế hoạch NT theo đợt: từ ngày → đến ngày + số đợt
ALTER TABLE "revenue_plans"
  ADD COLUMN IF NOT EXISTS "batch_sequence" INTEGER,
  ADD COLUMN IF NOT EXISTS "period_start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "period_end_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "schedule_id" UUID;

ALTER TABLE "revenue_plans"
  ADD CONSTRAINT "revenue_plans_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "acceptance_schedules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "revenue_plans_contract_batch_sequence_key"
  ON "revenue_plans" ("contractId", "batch_sequence")
  WHERE "batch_sequence" IS NOT NULL;

ALTER TABLE "acceptance_schedules"
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
