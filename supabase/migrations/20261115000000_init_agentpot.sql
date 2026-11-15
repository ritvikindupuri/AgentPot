-- AgentPot Supabase Schema Migration
-- Realtime honeypot for AI agent monitoring, prompt injections, and decoy traps

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Canaries table: library of planted prompt injections
create table if not exists public.canaries (
    id text primary key,
    name text not null,
    technique text not null check (technique in ('hidden_text', 'html_comment', 'markdown_injection', 'zero_width', 'alt_text', 'system_prompt_override', 'credential_leak')),
    location text not null,
    planted_action text not null,
    planted_payload text,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Planted credentials table: decoy API keys
create table if not exists public.planted_credentials (
    key_id text primary key,
    key_name text not null,
    location text not null,
    canary_id text references public.canaries(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Sessions table: agent interaction sessions
create table if not exists public.sessions (
    id text primary key,
    ip_address text,
    user_agent text,
    agent_family text not null default 'Unknown',
    client_info jsonb default '{}'::jsonb,
    severity_score integer not null default 0,
    event_count integer not null default 0,
    first_seen timestamptz not null default timezone('utc'::text, now()),
    last_seen timestamptz not null default timezone('utc'::text, now())
);

-- 4. Events table: honeypot activity log
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    session_id text references public.sessions(id) on delete cascade,
    event_type text not null check (event_type in ('crawl', 'injection_fired', 'tool_call', 'credential_use', 'exfil_attempt')),
    canary_id text references public.canaries(id) on delete set null,
    agent_family text not null default 'Unknown',
    source_endpoint text not null,
    request_method text not null,
    ip_address text,
    user_agent text,
    headers jsonb default '{}'::jsonb,
    payload jsonb default '{}'::jsonb,
    severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 5. Agent API keys table: authenticated test agents for /api/ingest
create table if not exists public.agent_api_keys (
    id uuid primary key default gen_random_uuid(),
    key_hash text unique not null,
    agent_name text not null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    revoked boolean not null default false
);

-- Indexes for performance
create index if not exists idx_events_created_at on public.events(created_at desc);
create index if not exists idx_events_session_id on public.events(session_id);
create index if not exists idx_events_event_type on public.events(event_type);
create index if not exists idx_events_canary_id on public.events(canary_id);
create index if not exists idx_sessions_last_seen on public.sessions(last_seen desc);
create index if not exists idx_sessions_severity on public.sessions(severity_score desc);
create index if not exists idx_canaries_technique on public.canaries(technique);

-- Enable Row Level Security
alter table public.canaries enable row level security;
alter table public.planted_credentials enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.agent_api_keys enable row level security;

-- RLS Policies
-- Allow public read of canaries definition if needed
create policy "Allow public read of canaries" on public.canaries
    for select using (true);

-- Allow authenticated users to view all honeypot telemetry
create policy "Allow authenticated read of sessions" on public.sessions
    for select using (auth.role() = 'authenticated');

create policy "Allow authenticated read of events" on public.events
    for select using (auth.role() = 'authenticated');

create policy "Allow authenticated read of planted_credentials" on public.planted_credentials
    for select using (auth.role() = 'authenticated');

create policy "Allow authenticated read of agent_api_keys" on public.agent_api_keys
    for select using (auth.role() = 'authenticated');

-- Enable Realtime for live dashboard feeds
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.events;
        alter publication supabase_realtime add table public.sessions;
    end if;
end $$;
