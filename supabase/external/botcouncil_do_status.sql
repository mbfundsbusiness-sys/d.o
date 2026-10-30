-- Applied to the BotCouncil Supabase project (bot-council-v1), not to D.O.
-- A read-only status summary for D.O.'s Freelance assistant: sweeps, forecast
-- volume and accuracy, council readiness, AI spend and user counts. Aggregates
-- only; no emails, no per-user rows. D.O. calls it over PostgREST with
-- BotCouncil's publishable key plus a token; the function only answers when the
-- token's SHA-256 matches. The token is D.O.'s CRON_SECRET (or
-- BOTCOUNCIL_STATUS_TOKEN if set). Rotate it by re-running this with the new hash.

create or replace function public.do_status_summary(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_token is null or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> '<sha256 of the token>' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'sweeps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'timeframe', s.timeframe, 'status', s.status, 'last_completed_at', s.last_completed_at,
        'assets_succeeded', s.assets_succeeded, 'assets_failed', s.assets_failed) order by s.timeframe), '[]'::jsonb)
      from public.sweep_status s),
    'forecasts', (
      select jsonb_build_object(
        'last_at', max(f.created_at),
        'last_24h', count(*) filter (where f.created_at > now() - interval '24 hours'),
        'last_7d', count(*) filter (where f.created_at > now() - interval '7 days'))
      from public.forecasts f),
    'accuracy_30d', (
      select jsonb_build_object('resolved', count(*), 'correct', count(*) filter (where o.direction_correct))
      from public.forecast_outcomes o
      where o.resolved_at > now() - interval '30 days' and not coalesce(o.excluded_from_scoring, false)),
    'readiness', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'council', r.council, 'ready', r.ready, 'accuracy', round(r.accuracy, 1), 'n', r.n, 'checked_at', r.checked_at)
        order by r.council), '[]'::jsonb)
      from (select distinct on (c.council) c.* from public.council_readiness_checks c order by c.council, c.checked_at desc) r),
    'ai_cost_usd', (
      select jsonb_build_object(
        'today', coalesce(sum(d.total_usd) filter (where d.cost_date = current_date), 0),
        'last_7d', coalesce(sum(d.total_usd) filter (where d.cost_date > current_date - 7), 0),
        'month', coalesce(sum(d.total_usd) filter (where d.cost_date >= date_trunc('month', current_date)), 0))
      from public.daily_cost_tracker d),
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active_7d', count(*) filter (where u.last_active > now() - interval '7 days'),
        'new_7d', count(*) filter (where u.created_at > now() - interval '7 days'))
      from public.users u)
  );
end;
$$;

revoke all on function public.do_status_summary(text) from public, authenticated;
grant execute on function public.do_status_summary(text) to anon;
