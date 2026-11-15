-- Migration: 20261115000200_mcp_event_types.sql
-- Add mcp_connect and tool_discovery to events_event_type_check

alter table public.events drop constraint events_event_type_check;
alter table public.events add constraint events_event_type_check check (event_type in ('crawl','injection_fired','tool_call','credential_use','exfil_attempt','mcp_connect','tool_discovery'));
