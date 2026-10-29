-- D.O. chat rebuild, Phase 1 (EA, schedule, Finance).
-- Data from before the rebuild is exported in do-public-data-2026-10-29.json.
-- Kept and unchanged: prayer alerts (send_due_alerts), payday alert, prayer cache,
-- pots / wishlist / bills / pay_settings, uni lectures, language and course tables.

-- 1. Retire the old modules. The long-timer alert read the old session tables.
select cron.unschedule('do-long-timer-alerts')
  where exists (select 1 from cron.job where jobname = 'do-long-timer-alerts');
drop function if exists public.send_long_timer_alerts();

drop table if exists
  public.anchor_logs, public.job_applications, public.job_search_sessions,
  public.trading_sessions, public.gym_sessions, public.gym_assessments, public.gym_plans,
  public.gym_checkins, public.gym_prs, public.ghostwriter_style_lyrics, public.ghostwriter_references,
  public.ghostwriter_songs, public.ghostwriter_chat_messages, public.reading_sessions,
  public.reading_materials, public.reading_highlights, public.botcouncil_checks,
  public.botcouncil_tasks, public.botcouncil_sessions, public.assistant_conversations,
  public.finance_entries, public.prayer_logs, public.payday_runs
  cascade;

-- Leftover from the wipe (its schedule rows are already gone).
delete from public.recurring_commitments where label = 'Daily Logging Reminder';

-- 2. Rules: every routine setting the assistants change by chat.
create table if not exists public.assistant_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.assistant_settings enable row level security;
create policy "own assistant_settings" on public.assistant_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Chat history, one thread per assistant. `parts` is the AI SDK UIMessage parts array.
create table if not exists public.chat_messages (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assistant text not null check (assistant in ('ea', 'finance', 'scholarship', 'freelance')),
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_assistant_idx on public.chat_messages (user_id, assistant, created_at);
alter table public.chat_messages enable row level security;
create policy "own chat_messages" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Dated plan: what the EA lined up for a day, and whether it happened.
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  kind text not null default 'other'
    check (kind in ('exams', 'coursework', 'study', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other')),
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped', 'dropped')),
  source text not null default 'ea' check (source in ('ea', 'user')),
  todo_id uuid references public.todo_items (id) on delete set null,
  note text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists plan_items_user_date_idx on public.plan_items (user_id, plan_date, start_time);
alter table public.plan_items enable row level security;
create policy "own plan_items" on public.plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger plan_items_touch before update on public.plan_items
  for each row execute function public.touch_updated_at();

-- 5. To-dos get a category (coursework/exams outrank everything) and a size.
alter table public.todo_items
  add column if not exists category text not null default 'task'
    check (category in ('exams', 'coursework', 'trading', 'botcouncil', 'gym', 'language', 'task', 'other')),
  add column if not exists priority int not null default 3 check (priority between 1 and 5),
  add column if not exists estimate_min int check (estimate_min between 5 and 600);

-- 6. DPD shift tracker: what actually happened, and the drops it paid for.
alter table public.work_shifts
  add column if not exists actual_start time,
  add column if not exists actual_end time,
  add column if not exists drops int check (drops >= 0),
  add column if not exists rate_per_drop numeric check (rate_per_drop >= 0);

-- 7. Bills and subscriptions share one table.
alter table public.bills
  add column if not exists kind text not null default 'bill' check (kind in ('bill', 'subscription')),
  add column if not exists cadence text not null default 'monthly' check (cadence in ('weekly', 'monthly', 'yearly')),
  add column if not exists due_dom int check (due_dom between 1 and 31);

-- 8. App pings (morning brief, evening review, slacking callouts) run in the app.
-- pg_cron nudges it every 5 minutes; app_url and cron_secret are filled in after deploy.
alter table public.notify_config
  add column if not exists app_url text,
  add column if not exists cron_secret text;

create or replace function public.ping_app_tick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  cfg record;
begin
  select app_url, cron_secret into cfg from notify_config where id = 1;
  if cfg.app_url is null or cfg.cron_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(cfg.app_url, '/') || '/api/cron/tick',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cfg.cron_secret),
    timeout_milliseconds := 60000
  );
end $function$;
revoke all on function public.ping_app_tick() from public, anon, authenticated;

select cron.schedule('do-app-tick', '*/5 * * * *', 'select public.ping_app_tick();')
  where not exists (select 1 from cron.job where jobname = 'do-app-tick');
