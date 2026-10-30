-- Phase 1 audit: findings from the Supabase security/performance advisors.

-- rls_auto_enable is an event-trigger helper; nobody should call it over the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Pin the search_path of the updated_at trigger function.
alter function public.touch_updated_at() set search_path = public;

-- plan_items.todo_id is a foreign key used when a to-do is completed or deleted.
create index if not exists plan_items_todo_id_idx on public.plan_items (todo_id);

-- The payday ping pointed at the old "Invest" page; point it at the Finance assistant.
do $$
declare d text;
begin
  select pg_get_functiondef('public.send_payday_alert()'::regprocedure) into d;
  d := replace(replace(d, 'Open Invest, enter what landed, and it will show where it goes.', 'Open Finance in D.O. and tell it what landed.'), 'Open Invest to confirm.', 'Open Finance in D.O. to confirm.');
  execute d;
end $$;
