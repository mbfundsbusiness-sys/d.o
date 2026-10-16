-- Real prayer times without manual edits: public.refresh_prayer_cache() (applied to the live DB) runs hourly via
-- cron 'do-prayer-times', fetches the next 7 days from Aladhan (Moonsighting Committee, central London) with pg_net,
-- and fills prayer_time_cache. send_due_alerts() and the schedule UI read today's row instead of the template time.
create table if not exists public.prayer_fetch (req_id bigint primary key, for_date date not null, handled boolean not null default false, created_at timestamptz not null default now());
alter table public.prayer_fetch enable row level security;
