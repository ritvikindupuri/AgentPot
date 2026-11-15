-- Add link_scan and lure_followed event types, and score
-- credential_use repeats and those types correctly.

alter table public.events drop constraint if exists events_event_type_check;
alter table public.events add constraint events_event_type_check
  check (event_type in (
    'crawl',
    'injection_fired',
    'tool_call',
    'credential_use',
    'exfil_attempt',
    'mcp_connect',
    'tool_discovery',
    'link_scan',
    'lure_followed'
  ));

create or replace function public.session_event_score_points(
  p_event_type text,
  p_payload jsonb,
  p_session_has_injection boolean,
  p_repeat_credential boolean default false
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
    if p_repeat_credential then
      return 2;
    end if;
    return 35;
  end if;
  if p_event_type = 'injection_fired' then
    return 40;
  end if;
  if p_event_type = 'lure_followed' then
    return 5;
  end if;
  if p_event_type = 'link_scan' then
    return 2;
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

create or replace function public.credential_key_from_payload(p_payload jsonb)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(
    p_payload->>'matched_credential',
    p_payload->>'presented_key',
    p_payload->>'key_id',
    ''
  )), '');
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
  v_key text;
  v_repeat boolean;
  v_seen_keys text[] := array[]::text[];
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
    v_key := public.credential_key_from_payload(coalesce(r.payload, '{}'::jsonb));
    v_repeat := r.event_type = 'credential_use' and v_key is not null and v_key = any (v_seen_keys);
    v_score := least(100, greatest(0, v_score + public.session_event_score_points(
      r.event_type,
      coalesce(r.payload, '{}'::jsonb),
      v_has_injection and r.event_type = 'tool_call',
      v_repeat
    )));
    if r.event_type = 'credential_use' and v_key is not null and not v_repeat then
      v_seen_keys := array_append(v_seen_keys, v_key);
    end if;
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
