-- Phase 3 (Freelance): trading notes as slides, seeded only from what the user gives
-- (their notes .docx, or what they say in chat). Images from an imported .docx go in
-- the private trading-notes bucket; the server hands out short-lived signed links.
-- Phase 4: rewards bought with earned free time.

create table if not exists public.trading_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position int not null,
  section text,
  title text not null,
  body text not null default '',
  -- The file a slide came from (re-importing that file replaces its slides); null = written in chat.
  source_file text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trading_notes_user_pos_idx on public.trading_notes (user_id, position);
alter table public.trading_notes enable row level security;
create policy "own trading_notes" on public.trading_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trading_notes_touch before update on public.trading_notes
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('trading-notes', 'trading-notes', false)
on conflict (id) do nothing;

-- The browser uploads a .docx straight into the user's own folder (files are too big
-- for a serverless request body); the import route reads it with the service role.
create policy "upload own trading notes files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trading-notes' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  cost_min int not null check (cost_min between 5 and 1440),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rewards_user_idx on public.rewards (user_id);
alter table public.rewards enable row level security;
create policy "own rewards" on public.rewards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  title text not null,
  cost_min int not null check (cost_min between 1 and 1440),
  redeemed_at timestamptz not null default now()
);
create index if not exists reward_redemptions_user_idx on public.reward_redemptions (user_id, redeemed_at);
alter table public.reward_redemptions enable row level security;
create policy "own reward_redemptions" on public.reward_redemptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
