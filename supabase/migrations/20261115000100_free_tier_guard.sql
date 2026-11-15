-- Free-tier safety: 30-day retention + cap raw headers/payload size.

-- Canary ids come from the app's code library, not a DB table, so don't FK them.
alter table public.events drop constraint if exists events_canary_id_fkey;
alter table public.planted_credentials drop constraint if exists planted_credentials_canary_id_fkey;

-- Truncate oversized jsonb (limit in bytes of the text form).
create or replace function public.agentpot_cap_jsonb(j jsonb, max_bytes int)
returns jsonb language plpgsql immutable as $$
declare t text;
begin
  if j is null then return j; end if;
  t := j::text;
  if octet_length(t) <= max_bytes then return j; end if;
  return jsonb_build_object('_truncated', true, '_original_bytes', octet_length(t),
                            'preview', left(t, max_bytes - 200));
end $$;

create or replace function public.agentpot_cap_event_sizes()
returns trigger language plpgsql as $$
begin
  new.headers := public.agentpot_cap_jsonb(new.headers, 4096);
  new.payload := public.agentpot_cap_jsonb(new.payload, 8192);
  new.user_agent := left(new.user_agent, 512);
  return new;
end $$;

drop trigger if exists trg_agentpot_cap_event_sizes on public.events;
create trigger trg_agentpot_cap_event_sizes
  before insert or update on public.events
  for each row execute function public.agentpot_cap_event_sizes();

create or replace function public.agentpot_cap_session_sizes()
returns trigger language plpgsql as $$
begin
  new.client_info := public.agentpot_cap_jsonb(new.client_info, 2048);
  new.user_agent := left(new.user_agent, 512);
  return new;
end $$;

drop trigger if exists trg_agentpot_cap_session_sizes on public.sessions;
create trigger trg_agentpot_cap_session_sizes
  before insert or update on public.sessions
  for each row execute function public.agentpot_cap_session_sizes();

-- Daily cleanup of anything older than 30 days.
create extension if not exists pg_cron;

create or replace function public.agentpot_cleanup_old()
returns void language sql security definer set search_path = public as $$
  delete from public.events where created_at < now() - interval '30 days';
  delete from public.sessions where last_seen < now() - interval '30 days';
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'agentpot-cleanup';
select cron.schedule('agentpot-cleanup', '17 4 * * *', 'select public.agentpot_cleanup_old()');
