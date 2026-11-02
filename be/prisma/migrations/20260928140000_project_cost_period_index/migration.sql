-- Index for cross-project / dashboard aggregation by month (YYYY-MM)
CREATE INDEX IF NOT EXISTS "project_operating_costs_period_idx" ON "project_operating_costs"("period");
