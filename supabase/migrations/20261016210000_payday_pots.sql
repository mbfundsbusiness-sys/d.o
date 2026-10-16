-- Payday planner: per-goal pots (wishlist_items.saved_amount), fixed bills, pay settings, payday history.
-- Applied to the live DB directly; public.send_payday_alert() + cron 'do-payday-alert' (07:00/08:00 UTC, fires at 08:00 London) live there too.
alter table public.wishlist_items add column if not exists saved_amount numeric(12,2) not null default 0;
create table if not exists public.pay_settings (user_id uuid primary key default auth.uid(), payday_dom int check (payday_dom between 1 and 31), expected_pay numeric(12,2), updated_at timestamptz not null default now());
create table if not exists public.bills (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), name text not null, amount numeric(12,2) not null check (amount >= 0), active boolean not null default true, created_at timestamptz not null default now());
create table if not exists public.payday_runs (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), pay_date date not null, pay_amount numeric(12,2) not null, plan jsonb not null, created_at timestamptz not null default now());
alter table public.pay_settings enable row level security;
alter table public.bills enable row level security;
alter table public.payday_runs enable row level security;
-- RLS: owner-only policies on all three (select/insert/update on pay_settings, all on bills, select/insert on payday_runs).
