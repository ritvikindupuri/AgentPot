-- Flag team and Agent Tester probes so the dashboard can show real-agent traffic only.
alter table public.events add column if not exists is_test boolean not null default false;
alter table public.sessions add column if not exists is_test boolean not null default false;

create index if not exists idx_events_is_test on public.events (is_test);
create index if not exists idx_sessions_is_test on public.sessions (is_test);
create index if not exists idx_sessions_user_agent_last_seen on public.sessions (user_agent, last_seen desc);
