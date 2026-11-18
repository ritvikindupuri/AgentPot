-- Single-tenant company settings, org_id on sessions/events,
-- and session score caps: 40 with no tools, 60 unless real misuse, 100 only on misuse.

create table if not exists public.company_settings (
  id text primary key default 'default',
  org_id text not null default 'org_default',
  company_name text not null default 'Corvane',
  decoy_hostname text not null default '',
  decoys_enabled jsonb not null default '{"mcp":true,"docs":true,"llms.txt":true,"manifests":true}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id, org_id, company_name, decoy_hostname, decoys_enabled)
values (
  'default',
  'org_default',
  'Corvane',
  '',
  '{"mcp":true,"docs":true,"llms.txt":true,"manifests":true}'::jsonb
)
on conflict (id) do nothing;

alter table public.sessions add column if not exists org_id text not null default 'org_default';
alter table public.events add column if not exists org_id text not null default 'org_default';

create or replace function public.event_is_real_misuse(
  p_event_type text,
  p_payload jsonb,
  p_source_endpoint text,
  p_canary_id text
) returns boolean
language plpgsql
immutable
as $$
declare
  v_path text;
  v_canary text;
begin
  v_path := split_part(coalesce(p_source_endpoint, ''), '?', 1);
  if v_path = '/api/v1/aws' or v_path like '/api/v1/aws/%'
     or v_path = '/api/decoy/aws' or v_path like '/api/decoy/aws/%' then
    return true;
  end if;
  v_canary := coalesce(p_canary_id, p_payload->>'canary_id', '');
  if p_event_type = 'credential_use' and v_canary in (
    'canary-cred-aws-01',
    'canary-cred-openai-02',
    'canary-cred-mcp-04'
  ) then
    return true;
  end if;
  return false;
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
  v_has_tool boolean := false;
  v_has_misuse boolean := false;
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
    select event_type, payload, agent_family, source_endpoint, canary_id
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
    if public.event_is_real_misuse(r.event_type, coalesce(r.payload, '{}'::jsonb), r.source_endpoint, r.canary_id) then
      v_has_misuse := true;
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

  if v_has_misuse then
    null;
  elsif v_has_tool then
    v_score := least(60, v_score);
  else
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
