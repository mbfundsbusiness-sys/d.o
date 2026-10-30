-- Phase 2 (Scholarship): tie to-dos and plan blocks to a uni module (or the language course),
-- so deadlines drive study time and every module's hours can be counted.

alter table public.todo_items
  add column if not exists module_key text
    check (module_key in ('programming', 'circuits', 'maths', 'engsci', 'language'));

alter table public.plan_items
  add column if not exists module_key text
    check (module_key in ('programming', 'circuits', 'maths', 'engsci', 'language'));

create index if not exists plan_items_user_module_idx on public.plan_items (user_id, module_key, plan_date)
  where module_key is not null;
