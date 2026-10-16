-- Server-side alerts via ntfy.sh, driven by pg_cron every minute.
-- Applied to the live DB directly. The ntfy topic lives in public.notify_config (RLS on, no policies),
-- never in this repo. Function body: see live DB (public.send_due_alerts).
create extension if not exists pg_net;
create extension if not exists pg_cron;
create table if not exists public.notify_config (id int primary key default 1 check (id = 1), topic text not null);
alter table public.notify_config enable row level security;
create table if not exists public.notify_log (key text primary key, sent_at timestamptz not null default now());
alter table public.notify_log enable row level security;
-- select cron.schedule('do-send-due-alerts', '* * * * *', 'select public.send_due_alerts();');
