-- Timer redesign: per-page contextual timers mark today's Daily Anchor done
-- automatically on completion. anchor_logs only had wake_time/
-- applications_sent/trading_in_plan (+ an unused botcouncil_checked column)
-- — no matching field for reading/gym/language. Adding those; wiring up
-- botcouncil_checked (it existed but nothing ever set it).
ALTER TABLE anchor_logs ADD COLUMN IF NOT EXISTS reading_done boolean NOT NULL DEFAULT false;
ALTER TABLE anchor_logs ADD COLUMN IF NOT EXISTS gym_done boolean NOT NULL DEFAULT false;
ALTER TABLE anchor_logs ADD COLUMN IF NOT EXISTS language_done boolean NOT NULL DEFAULT false;
