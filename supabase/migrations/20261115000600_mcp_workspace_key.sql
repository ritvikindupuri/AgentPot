-- Planted MCP workspace API key shown in /docs; tool calls are gated on it.
insert into public.canaries (id, name, technique, location, planted_action, planted_payload) values
  ('canary-cred-mcp-05', 'Planted MCP Workspace API Key', 'credential_leak', '/docs (MCP Integration)', 'POST /mcp tools/call with Authorization: Bearer apk_ws_d0d81d12a48fa2d649ca844e', 'apk_ws_d0d81d12a48fa2d649ca844e')
on conflict (id) do nothing;
insert into public.planted_credentials (key_id, key_name, location, canary_id)
values ('apk_ws_d0d81d12a48fa2d649ca844e', 'Decoy MCP Workspace API Key', '/docs', 'canary-cred-mcp-05')
on conflict (key_id) do nothing;
