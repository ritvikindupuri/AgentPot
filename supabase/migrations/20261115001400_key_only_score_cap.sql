-- Cap session severity_score at 40 when the session has no
-- tools/call and no read_secrets event.

create or replace function public.refresh_session_stats(p_session_id text)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_score integer := 0;
  v_has_injection boolean := false;
  v_has_tool boolean := false;
  v_last timestamptz;
  v_family text;
  v_key text;
  v_repeat boolean;
  v_tool text;
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
    v_tool := lower(coalesce(r.payload->>'tool', r.payload->>'toolName', ''));
    if r.event_type = 'tool_call' or v_tool = 'read_secrets' or v_tool like '%secret%' then
      v_has_tool := true;
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

  if not v_has_tool then
    v_score := least(40, v_score);
  end if;

  update public.sessions
     set event_count = coalesce(v_count, 0),
         severity_score = v_score,
         last_seen = coalesce(v_last, last_seen),
         agent_family = coalesce(v_family, agent_family)
   where id = p_session_id;
end;
$$;
