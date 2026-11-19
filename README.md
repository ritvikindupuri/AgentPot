# AgentPot

An agentic honeypot for AI-agent security. Public decoys (a decoy MCP server, documentation-style pages, and canary links) present as Corvane, a fictional product, while the repo and dashboard stay AgentPot. Every real interaction is classified and stored in Supabase, and a live dashboard shows what happened. Decoys are inert: they never run a command, send mail or money, or fetch a caller-supplied URL. A small Grok Bot team designs the lures, reads the traffic, and tests the surfaces.

Live demo: [https://agentpot-app.vercel.app](https://agentpot-app.vercel.app)

## Architecture

<p align="center">
  <img src="docs/architecture.png" alt="How AgentPot works" width="850">
</p>
<p align="center"><b>Figure 1. How AgentPot works</b></p>

## How it works

- Agents, MCP clients, and crawlers find the decoys through search, AI fetchers, or MCP directories.
- They may load docs, follow a canary link, call `/api/v1`, or connect to the decoy MCP server at [`/mcp`](https://corvane-gateway.vercel.app/mcp). The decoy returns fake text only.
- Each request is classified, header-sanitized, and written to Supabase. Session scores stay at or below 40 with no tool call, 60 after `read_secrets` alone, and only reach 100 on real misuse (a planted AWS or OpenAI key, the planted AWS endpoint, or an instruction planted inside a secret). Team probes that send `X-AgentPot-Test` are stored but kept out of the live dashboard.
- Events in the same client session are linked together, and the shared dashboard updates about every four seconds.
- Attack Analyst reviews the traffic, Decoy Builder adjusts lures, and Agent Tester checks the live surfaces. The Honeypot Lead coordinates.

Full rules for sessions, severity, canaries, and tests are in [docs/DETAILS.md](docs/DETAILS.md).

## Decoys

Public surfaces use a configurable bait name (default Corvane). The company name, decoy hostname, and which decoys are enabled are edited from the dashboard Settings page. Planted secret values are not listed here.

| Decoy | What it baits | What gets logged |
|-------|----------------|------------------|
| Decoy MCP server at [`/mcp`](https://corvane-gateway.vercel.app/mcp) (`Corvane Secure Infrastructure Gateway`) | Fake tools, a deploy-config resource, an incident-triage prompt, and a planted workspace key | MCP connect, tool discovery, tool calls, and credential use |
| Docs and manifests ([`/docs`](https://corvane-gateway.vercel.app/docs), [`/readme`](https://corvane-gateway.vercel.app/readme), [`/llms.txt`](https://corvane-gateway.vercel.app/llms.txt), `robots.txt`, `/.well-known/agent.json`, `/.well-known/ai-plugin.json`) | Setup-style canary links and sandbox credentials | Page reads, followed lures, and credential use |
| Canary links (`/c/<token>` and aliases such as `/v1/register/<token>`, `/status/<token>`, `/reference/<token>`) | Followed lure URLs | Injection hits, or a lower-severity link scan / followed-lure event when the pattern is only a rapid crawl |

## Team

| Bot | Role | Template |
|-----|------|----------|
| Honeypot Lead (yellow hex) | Coordinates the team, keeps decoys inert, and decides what gets changed. | [Import](https://x.ai/bot/rpnvitFIbtXcp-0sW8M-m) |
| Decoy Builder (orange flower) | Designs and maintains the decoy MCP server, documentation-style pages, and canary placements. | [Import](https://x.ai/bot/ESkmgyvKc9IasmAC2dVUp) |
| Attack Analyst (red shield) | Reads classified events and sessions, looks for patterns, and reports what agents actually did. | [Import](https://x.ai/bot/KYtW8NwkeSA39C9stIkR-) |
| Agent Tester (green capsule) | Probes live decoy surfaces and dashboard auth paths, and reports regressions. | [Import](https://x.ai/bot/7H7-KOtOR8eOyh4Jt72Ck) |

## Quick start

You need Node.js 22 and a Supabase project. Copy `.env.example` to `.env.local` and fill in the values. Do not commit `.env.local`. Then apply every file in `supabase/migrations/` in timestamp order.

```bash
git clone https://github.com/ritvikindupuri/AgentPot.git
cd AgentPot
cp .env.example .env.local
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, and go to `/dashboard`. Decoy routes such as `/mcp` and `/docs` are public by design.

## Deploy

The dashboard is on Vercel at [https://agentpot-app.vercel.app](https://agentpot-app.vercel.app). Public decoys use [https://corvane-gateway.vercel.app](https://corvane-gateway.vercel.app). Create a Vercel project, set the same secrets as `.env.local`, use Node.js 22.x, apply the Supabase migrations, and turn off Deployment Protection so decoy routes stay public. More deploy, auth, and MCP registry notes are in [docs/DETAILS.md](docs/DETAILS.md).

## Links

- [Live demo](https://agentpot-app.vercel.app)
- [Dashboard](https://agentpot-app.vercel.app/dashboard)
- [Decoy MCP](https://corvane-gateway.vercel.app/mcp)
- [Details](docs/DETAILS.md)
- [GitHub](https://github.com/ritvikindupuri/AgentPot)
