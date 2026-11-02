-- Ca khúc / đợt bình chọn / phiếu vote (thống kê server-side từ votes.status = VALID)

CREATE TYPE "MusicTrackConversionStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "MusicTrackPublicStatus" AS ENUM ('DRAFT', 'PUBLIC', 'HIDDEN');
CREATE TYPE "VotingCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "VoteRecordStatus" AS ENUM ('VALID', 'REJECTED', 'REVOKED');

CREATE TABLE "music_tracks" (
    "id" UUID NOT NULL,
    "song_code" TEXT NOT NULL,
    "contestant_code" TEXT NOT NULL,
    "performer_name" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "song_title" TEXT NOT NULL,
    "original_file_path" TEXT,
    "mp3_file_path" TEXT,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT,
    "conversion_status" "MusicTrackConversionStatus" NOT NULL DEFAULT 'PENDING',
    "public_status" "MusicTrackPublicStatus" NOT NULL DEFAULT 'DRAFT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_tracks_song_code_key" ON "music_tracks"("song_code");
CREATE INDEX "music_tracks_contestant_code_idx" ON "music_tracks"("contestant_code");
CREATE INDEX "music_tracks_public_status_display_order_idx" ON "music_tracks"("public_status", "display_order");

CREATE TABLE "voting_campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "status" "VotingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "max_tracks_per_ballot" INTEGER NOT NULL DEFAULT 0,
    "result_publish_config" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voting_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voting_campaigns_status_start_at_end_at_idx" ON "voting_campaigns"("status", "start_at", "end_at");

CREATE TABLE "voting_campaign_tracks" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voting_campaign_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voting_campaign_tracks_campaign_id_track_id_key" ON "voting_campaign_tracks"("campaign_id", "track_id");
CREATE INDEX "voting_campaign_tracks_campaign_id_display_order_idx" ON "voting_campaign_tracks"("campaign_id", "display_order");

ALTER TABLE "voting_campaign_tracks" ADD CONSTRAINT "voting_campaign_tracks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "voting_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voting_campaign_tracks" ADD CONSTRAINT "voting_campaign_tracks_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "music_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "status" "VoteRecordStatus" NOT NULL DEFAULT 'VALID',
    "voter_key" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "votes_campaign_id_track_id_status_idx" ON "votes"("campaign_id", "track_id", "status");
CREATE INDEX "votes_campaign_id_voter_key_idx" ON "votes"("campaign_id", "voter_key");
CREATE INDEX "votes_campaign_id_created_at_idx" ON "votes"("campaign_id", "created_at");

ALTER TABLE "votes" ADD CONSTRAINT "votes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "voting_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "votes" ADD CONSTRAINT "votes_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "music_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
