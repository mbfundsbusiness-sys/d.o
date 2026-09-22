-- Scheduling rework (2/6): gym registers into recurring_commitments.
-- training_days replaces the plain days_per_week count as the source of
-- which weekdays gym plan generation registers into recurring_commitments
-- (days_per_week is kept for backward compatibility and the AI prompt).
ALTER TABLE gym_assessments ADD COLUMN IF NOT EXISTS training_days smallint[];
