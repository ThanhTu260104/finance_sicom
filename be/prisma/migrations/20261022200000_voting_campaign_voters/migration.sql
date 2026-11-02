-- Whitelist nhân viên được bình chọn theo đợt
CREATE TABLE "voting_campaign_voters" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_campaign_voters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voting_campaign_voters_campaign_id_employee_code_key" ON "voting_campaign_voters"("campaign_id", "employee_code");
CREATE INDEX "voting_campaign_voters_campaign_id_idx" ON "voting_campaign_voters"("campaign_id");

ALTER TABLE "voting_campaign_voters" ADD CONSTRAINT "voting_campaign_voters_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "voting_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "votes" ADD COLUMN "employee_code" TEXT;

CREATE INDEX "votes_campaign_id_employee_code_idx" ON "votes"("campaign_id", "employee_code");
