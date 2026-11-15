-- Atomic session resolution (advisory lock + optional session_key upsert)
-- and atomic event_count / severity_score recounts.

alter table public.sessions
  add column if not exists session_key text;

create unique index if not exists idx_sessions_session_key
  on public.sessions (session_key)
  where session_key is not null;

create or replace function public.session_event_score_points(
  p_event_type text,
  p_payload jsonb,
  p_session_has_injection boolean
) returns integer
language plpgsql
immutable
as $$
declare
  v_tool text;
begin
  if p_event_type = 'exfil_attempt' then
    return 50;
  end if;
  if p_event_type = 'credential_use' then
    return 35;
  end if;
  if p_event_type = 'injection_fired' then
    return 40;
  end if;
  if p_event_type = 'tool_call' then
    v_tool := lower(coalesce(p_payload->>'tool', p_payload->>'toolName', ''));
    if v_tool = 'run_shell' or v_tool like '%shell%' or v_tool like '%exec%' then
      return 45;
    end if;
    if v_tool = 'transfer_funds' or v_tool like '%transfer%' then
      return 45;
    end if;
    if v_tool = 'read_secrets' or v_tool like '%secret%' then
      return 30;
    end if;
    if p_session_has_injection then
      return 30;
    end if;
    if v_tool = 'send_email' or v_tool = 'fetch_url' then
      return 20;
    end if;
    return 15;
  end if;
  if p_event_type = 'mcp_connect' then
    return 3;
  end if;
  if p_event_type = 'tool_discovery' then
    return 5;
  end if;
  if p_event_type = 'crawl' then
    return 2;
  end if;
  return 5;
end;
$$;

create or replace function public.refresh_session_stats(p_session_id text)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_score integer := 0;
  v_has_injection boolean := false;
  v_last timestamptz;
  v_family text;
  r record;
begin
  if p_session_id is null then
    return;
  end if;

  select count(*)::int, max(created_at)
    into v_count, v_last
    from public.events
   where session_id = p_session_id;

  for r in
    select event_type, payload, agent_family
      from public.events
     where session_id = p_session_id
     order by created_at asc
  loop
    if r.event_type = 'injection_fired' then
      v_has_injection := true;
    end if;
    v_score := least(100, greatest(0, v_score + public.session_event_score_points(
      r.event_type,
      coalesce(r.payload, '{}'::jsonb),
      v_has_injection and r.event_type = 'tool_call'
    )));
    if v_family is null or v_family = '' or lower(v_family) in ('unknown', 'generic / unknown agent') then
      if coalesce(r.agent_family, '') <> '' and lower(r.agent_family) not in ('unknown', 'generic / unknown agent') then
        v_family := r.agent_family;
      elsif v_family is null or v_family = '' then
        v_family := r.agent_family;
      end if;
    end if;
  end loop;

  update public.sessions
     set event_count = coalesce(v_count, 0),
         severity_score = v_score,
         last_seen = coalesce(v_last, last_seen),
         agent_family = coalesce(v_family, agent_family)
   where id = p_session_id;
end;
$$;

create or replace function public.events_refresh_session_stats()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_session_stats(old.session_id);
    return old;
  elsif tg_op = 'UPDATE' then
    perform public.refresh_session_stats(new.session_id);
    if old.session_id is distinct from new.session_id then
      perform public.refresh_session_stats(old.session_id);
    end if;
    return new;
  else
    perform public.refresh_session_stats(new.session_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_events_refresh_session_stats on public.events;
create trigger trg_events_refresh_session_stats
  after insert or delete or update of session_id, event_type, payload, agent_family
  on public.events
  for each row
  execute function public.events_refresh_session_stats();

create or replace function public.resolve_agent_session(
  p_hinted_id text,
  p_user_agent text,
  p_is_test boolean,
  p_run_id text,
  p_ip text,
  p_now timestamptz,
  p_window_seconds integer
) returns text
language plpgsql
as $$
declare
  v_id text;
  v_key text;
  v_ua text;
  v_now timestamptz;
  v_is_test boolean;
  v_window integer;
  v_hint text;
  v_run text;
begin
  v_now := coalesce(p_now, now());
  v_is_test := coalesce(p_is_test, false);
  v_window := coalesce(p_window_seconds, 1800);
  v_ua := left(coalesce(p_user_agent, ''), 512);
  v_hint := nullif(trim(coalesce(p_hinted_id, '')), '');
  v_run := nullif(trim(coalesce(p_run_id, '')), '');

  if v_hint is not null then
    v_id := v_hint;
    if v_is_test and v_id like 'sess_%' and v_id not like 'sess_test_%' then
      v_id := 'sess_test_' || substr(v_id, 6);
    end if;
    v_key := 'hint:' || v_id;
    perform pg_advisory_xact_lock(hashtext(v_key));
    insert into public.sessions (
      id, session_key, ip_address, user_agent, agent_family, client_info,
      severity_score, event_count, first_seen, last_seen, is_test
    ) values (
      v_id, v_key, p_ip, nullif(v_ua, ''), 'Generic / Unknown Agent', '{}'::jsonb,
      0, 0, v_now, v_now, v_is_test
    )
    on conflict (id) do update
      set last_seen = greatest(public.sessions.last_seen, excluded.last_seen),
          is_test = public.sessions.is_test or excluded.is_test,
          user_agent = coalesce(public.sessions.user_agent, excluded.user_agent),
          session_key = coalesce(public.sessions.session_key, excluded.session_key);
    return v_id;
  end if;

  if v_is_test and v_run is not null then
    v_key := 'test:run:' || left(v_run, 80);
    perform pg_advisory_xact_lock(hashtext(v_key));
    select s.id into v_id from public.sessions s where s.session_key = v_key;
    if v_id is not null then
      update public.sessions
         set is_test = true,
             user_agent = coalesce(user_agent, nullif(v_ua, ''))
       where id = v_id;
      return v_id;
    end if;
    v_id := 'sess_test_' || substr(md5(v_key), 1, 16);
    insert into public.sessions (
      id, session_key, ip_address, user_agent, agent_family, client_info,
      severity_score, event_count, first_seen, last_seen, is_test
    ) values (
      v_id, v_key, p_ip, nullif(v_ua, ''), 'Generic / Unknown Agent', '{}'::jsonb,
      0, 0, v_now, v_now, true
    )
    on conflict (id) do update
      set last_seen = greatest(public.sessions.last_seen, excluded.last_seen),
          is_test = true,
          session_key = coalesce(public.sessions.session_key, excluded.session_key)
    returning id into v_id;
    return v_id;
  end if;

  v_key := (case when v_is_test then 'test' else 'live' end) || ':ua:' || v_ua;
  perform pg_advisory_xact_lock(hashtext(v_key));

  select s.id into v_id
    from public.sessions s
   where coalesce(s.user_agent, '') = v_ua
     and coalesce(s.is_test, false) = v_is_test
     and (s.session_key is null or s.session_key not like 'test:run:%')
     and s.last_seen >= v_now - make_interval(secs => v_window)
   order by s.last_seen desc
   limit 1;

  if v_id is not null then
    update public.sessions
       set is_test = coalesce(is_test, false) or v_is_test
     where id = v_id;
    return v_id;
  end if;

  v_id := (case when v_is_test then 'sess_test_' else 'sess_' end)
          || substr(md5(v_key || ':' || v_now::text || ':' || gen_random_uuid()::text), 1, 16);
  insert into public.sessions (
    id, ip_address, user_agent, agent_family, client_info,
    severity_score, event_count, first_seen, last_seen, is_test
  ) values (
    v_id, p_ip, nullif(v_ua, ''), 'Generic / Unknown Agent', '{}'::jsonb,
    0, 0, v_now, v_now, v_is_test
  );
  return v_id;
end;
$$;

revoke all on function public.resolve_agent_session(text, text, boolean, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.resolve_agent_session(text, text, boolean, text, text, timestamptz, integer) to service_role;

revoke all on function public.refresh_session_stats(text) from public, anon, authenticated;
grant execute on function public.refresh_session_stats(text) to service_role;

-- Backfill counts and scores for every session.
do $$
declare
  r record;
begin
  for r in select id from public.sessions loop
    perform public.refresh_session_stats(r.id);
  end loop;
end;
$$;
