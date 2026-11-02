ALTER TABLE "voting_campaign_voters" ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "voting_campaign_voters_campaign_id_email_key" ON "voting_campaign_voters"("campaign_id", "email");
