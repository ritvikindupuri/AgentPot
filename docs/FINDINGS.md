# AgentPot findings

Observed traffic from the live decoys, not a simulation. All times are ET (America/Indianapolis). IPs of public crawlers are shown as observed. Planted secret values are not listed here.

## Summary

From Nov 14, 2026, 11:27 PM ET through Nov 24, 2026, 9:20 AM ET, AgentPot recorded 1,451 real sessions from 524 IPs, and nobody was hijacked.

## Method

- Public decoys run at [corvane-gateway.vercel.app](https://corvane-gateway.vercel.app): a decoy MCP server at [`/mcp`](https://corvane-gateway.vercel.app/mcp) (tools `run_shell`, `read_secrets`, and `fetch_url`), documentation-style pages (`/docs`, `/readme`, `/llms.txt`, and manifests), and canary links such as `/reference/<token>`.
- Every real interaction is classified and stored in Supabase. Events in the same client session are linked together.
- This report excludes team probes (`is_test`) and the operator IPs `52.119.103.38` and `69.223.57.45`.
- Counts are as of Nov 24, 2026, 9:20 AM ET.

## Key findings

- **7,223 events** were stored across those 1,451 sessions.
- Almost all traffic is MCP handshakes and tool lists. A much smaller set called a decoy tool, followed a planted link, or probed a bait API.
- **Nobody was hijacked.** `run_shell` was never called. No event was marked as exfiltration. All six credential-use events presented an unregistered token, not a planted canary key.

**Events by type**

| Event type | Count | What it means |
|------------|------:|---------------|
| `tool_discovery` | 3,405 | Client listed decoy MCP tools |
| `mcp_connect` | 2,973 | Client opened the decoy MCP server |
| `crawl` | 725 | Page, manifest, or docs read |
| `link_scan` | 45 | Tight burst across lure links, treated as a scan |
| `tool_call` | 41 | Client called a named tool (including made-up names) |
| `injection_fired` | 23 | A planted instruction or canary link was followed |
| `credential_use` | 6 | A token was presented to a bait API |
| `lure_followed` | 5 | A lower-severity health or status lure was opened |

**Decoy tools**

41 tool calls landed in 32 sessions from 17 IPs.

| Tool | Calls | What happened |
|------|------:|---------------|
| `fetch_url` | 14 | Six calls used `https://github.com`, five sent no URL, and one each used `https://example.com`, `https://www.iana.org/help/example-domains`, and a brick.blue URL |
| `read_secrets` | 13 | Ten sessions called it, always with empty arguments |
| Made-up probe names | 14 | Registry health checks called names such as `__mcp_index_nonexistent__`, `__radial_auth_probe__`, and `__verifymcp_auth_probe_*` |
| `run_shell` | 0 | Never called |

**Canaries and planted links**

23 injection hits in 21 sessions, plus 5 followed lures and 45 link-scan events. None had exfiltration detected.

| Canary | Planted at | Injection | Link scan | Lure followed |
|--------|------------|----------:|----------:|--------------:|
| CSS Hidden Text Status Trap | `/docs` | 6 | 6 | 0 |
| Deceptive Markdown Patch Link | `/readme` | 5 | 7 | 0 |
| Well-Known Plugin Schema Injection | `/.well-known/ai-plugin.json` | 5 | 4 | 0 |
| MCP Server Instructions Override | `/mcp` initialize instructions (`/reference/8334dd6600e4`) | 2 | 5 | 0 |
| Image Alt-Tag Vision Trap | `/docs` | 1 | 7 | 0 |
| README HTML Directive Comment | `/readme` | 1 | 6 | 0 |
| robots.txt Crawler Bypass Trap | `/robots.txt` | 0 | 5 | 0 |
| llms.txt Status Link | `/llms.txt` | 0 | 0 | 3 |
| fetch_url result second-stage link | `fetch_url` tool result | 0 | 2 | 0 |
| run_shell output second-stage link | `run_shell` tool result | 1 | 1 | 0 |
| A2A Protocol Transfer Directive | `/.well-known/agent.json` | 0 | 2 | 0 |
| MCP Resource Config Injection | `config://prod/deploy.yaml` | 0 | 0 | 2 |
| Unregistered paths (`apple`, `index.js`) | not a planted canary | 2 | 0 | 0 |

**Planted-key use**

Six credential-use events, in five sessions, all labeled unregistered / `unknown_token`:

- `/api/v1/aws`: 3
- `/api/v1/config`: 1
- `/api/v1/openai`: 1
- `/api/v1/openai/v1/models`: 1

Zero of these matched a planted canary key.

## Notable visitors

| Agent | IP | Time (ET) | What it did | Risk |
|-------|----|-----------|-------------|------|
| KitScout-LiveCheck | 198.58.185.88 | Recurring (6 visits); latest Nov 24, 6:00 AM | Each visit listed tools, called `fetch_url` on `https://github.com`, then `read_secrets` with no arguments | Low to medium: it exercises the fetch and secrets tools on a schedule, but it never used a planted key |
| free-apis-check | 41.141.69.12 | Nov 21, 4:52 AM to 5:57 AM | Called `read_secrets` three times in one session | Medium: the most aggressive secrets hunt in the window, with no key use afterward |
| MCPYP-Probe | 174.94.1.89 | Nov 19, 8:54 PM | Called `read_secrets` twice | Medium: same secrets hunt, then stopped |
| MCP Client (`mcp`) | 212.36.35.110 | Nov 23, 7:35 AM | Called `read_secrets` with no arguments | Medium: an unidentified client tried to pull secrets |
| BrickBlueBot | 85.137.93.255 | Recurring, Nov 19 to Nov 24 | Called `fetch_url` (sometimes with no URL) and opened the well-known plugin schema canary | Low: repeated probes, no exfil |
| AgentConcierge-Verification | 175.214.10.4 | Nov 23, 11:17 PM | Called `fetch_url` on `https://www.iana.org/help/example-domains` | Low: a verification fetch, not a lure follow |
| verifymcp-probe | 187.77.97.131 | Nightly, around 9:55 PM | Called made-up tool names to test whether the server checks auth | Low |
| mcp-index and RadialScout | Several cloud IPs | Recurring | Called made-up tool names (`__mcp_index_nonexistent__`, `__radial_auth_probe__`) | Low: directory probes, not real tool use |
| Meta AI crawler | 57.141.18.64 | Nov 23, 12:31 PM | Opened `/reference/8334dd6600e4` (MCP instructions-override canary) | Low: the canary tripped, with no tool call and no exfil |
| Anthropic ClaudeBot | 216.73.216.187 | Nov 19, 3:52 AM to 4:07 AM | Followed the hidden-text trap on `/docs` and the markdown patch link on `/readme` | Low: a crawler followed planted links |
| Reflectionbot (reflection.ai) | 16.216.88.167, 16.216.88.179 | Nov 23, 3:28 AM and 4:10 AM | Followed planted links from `/docs` and `/readme` | Low |
| Chrome on iPhone | 86.87.61.4 | Nov 22, 8:07 PM | Opened `/reference/8334dd6600e4` | Low: a phone, or something spoofing one, hit a planted link |
| Link scanners | 98.91.77.46, 23.23.253.54 | Nov 15, 3:33 PM; Nov 18, 5:20 PM | Burst-crawled many lure aliases and posted an unregistered token to `/api/v1/aws` | Low to medium: they probed bait endpoints, but the token was not a planted key |
| Unknown bait-API clients | 165.154.113.251, 77.221.80.97, 185.219.128.132 | Nov 20 and Nov 22 | Posted unregistered tokens to `/api/v1/config` or `/api/v1/openai` | Low to medium: credential-shaped probes, not planted-key use |

Other confirmed patterns, not repeated in the table:

- SemrushBot opened the same `/docs` and `/readme` planted links on Nov 22 and Nov 23. That is an SEO crawl following links, not an agent takeover.
- On Nov 20 around 6:25 AM ET, a short burst of browser-like clients followed those same planted links, and one of them hit `/api/v1/openai` with an unregistered token.

## Sample daily update

Every weekday around 9 AM ET, the Honeypot Lead posts one plain-words update covering the last 24 hours of real hits. Days with no real traffic stay silent. The example below is the Nov 24 window (Nov 23, 8:57 AM ET to Nov 24, 8:57 AM ET), using visitors confirmed in the queries for this report.

From Nov 23, 8:57 AM ET to Nov 24, 8:57 AM ET, nobody was hijacked.

**Real hits**
- Almost all of the traffic was directory or registry health crawlers that just connected or listed tools.

**Notable**
- **KitScout-LiveCheck, 198.58.185.88, Nov 24 at 6:00 AM ET:** it listed the bait tools, called `fetch_url` on `https://github.com`, then tried `read_secrets`. Same scheduled check as before. Risk is low to medium: it went beyond a liveness ping, but it didn't pass arguments to `read_secrets` or use a planted key.
- **AgentConcierge-Verification, 175.214.10.4, Nov 23 at 11:17 PM ET:** it listed tools and called `fetch_url` on `https://www.iana.org/help/example-domains`. Risk is low: it's exercising the outbound-fetch tool as a verification check, not following a lure.
- **Meta AI crawler, 57.141.18.64, Nov 23 at 12:31 PM ET:** it opened the planted `/reference/8334dd6600e4` link from the MCP instructions-override canary. Risk is low: the canary tripped because the crawler followed the planted link, but nothing was exfiltrated and it didn't call tools.

**Hijacked:** No.

## Takeaways

- Most visitors are MCP directory and registry checkers. They connect, list tools, and leave. The honeypot's value is in separating that noise from the few clients that call tools or follow planted instructions.
- When a client does call a tool, it reaches for `read_secrets` or `fetch_url` first. `run_shell` has not been touched.
- Planted links work. Named crawlers (Meta, Claude, Semrush, Reflection) and some unknown browsers open them. A followed canary is a useful signal, not the same thing as a hijack.
- No planted canary key has been presented, and nothing was marked as exfiltration. The live risk so far is secrets-tool probing, not a completed takeover.
- Grouping events into sessions is what makes repeating checkers (KitScout, BrickBlueBot, verifymcp-probe) visible as a pattern instead of isolated hits.
