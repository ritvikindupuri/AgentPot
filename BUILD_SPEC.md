# AgentPot: build spec

Build a complete, working web app called AgentPot in this folder. It's an agentic honeypot for AI-agent security. It baits AI agents (LLM agents, coding agents, autonomous crawlers, MCP clients) with decoys and records, in real time, exactly how they get manipulated.

**Hard rule:** NO mock, seed, sample, or fake data anywhere. Every event shown must come from a real request that hit a decoy. Empty states are fine.

## 1. Decoys (served by the same app, public)
- **Decoy MCP server:** Streamable HTTP JSON-RPC at /mcp, spec-compliant enough that real MCP clients can initialize, list tools, and call them. Tempting tools: send_email, run_shell, read_secrets, transfer_funds, fetch_url. Calls never do anything real and never make outbound requests. Log the full request (tool, args, clientInfo, headers, IP, user agent, session).
- **Poisoned content:** a docs page, README-style page, /llms.txt, /robots.txt, /.well-known/ai-plugin.json, and /.well-known/agent.json. They carry a library of distinct prompt-injection canaries (hidden text, HTML comments, markdown, zero-width unicode, alt text, etc.). Each canary has a unique ID and tells the agent to do a trackable action: hit /c/<canaryId>, call a specific decoy tool with the ID, or use a planted key. Any fired injection must be attributable.
- **Canary credentials:** fake API keys planted in pages. Any later use against /api/decoy/* is logged as credential_use and linked to where the key was planted.
- **Ingest API:** POST /api/ingest, authenticated with per-agent API keys, so friendly test agents can self-report events.

## 2. Classification
- Event types: crawl, injection_fired, tool_call, credential_use, exfil_attempt.
- Guess the agent family from user agent, clientInfo, and behavior heuristics.
- Group events into sessions and give each a severity score.

## 3. Shared realtime dashboard (protected)
- Live attack feed that updates instantly through Supabase Realtime.
- Panels: injection success rate per canary, agent families seen, tool-call attempts, canary credential use, a timeline chart, and a session drill-down showing the full chain of what one agent did.
- Clean, modern dark UI.
- Admin login via Supabase Auth or an env-var password.

## Stack and safety
- Next.js (App Router, TypeScript) and Supabase Postgres with Realtime, deployable to Vercel.
- SQL migrations and row-level security.
- Rate limiting and request-size limits on public endpoints. Decoys never execute anything or fetch on an attacker's behalf.
- Must run locally with `npm run dev` against a Supabase project set in .env.local.

## Deliverables
- Working app, migrations, and .env.example.
- README covering setup, Supabase and Vercel deploy, how to point real agents at the decoys, and a short threat model.
- Tests for the MCP decoy, canary attribution, and ingest auth.
- Verify `npm run build` passes and the tests pass.
