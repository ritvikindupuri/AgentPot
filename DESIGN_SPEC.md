# AgentPot Design Spec (v2 redesign)

Audience: the implementer (Antigravity). Goal: AgentPot must read as a sleek, minimal, enterprise security product, in the same family as Linear, Vercel, Datadog and Stripe's dashboard. Not "vibe coded". Fewer words, fewer colors, fewer boxes, more whitespace.

## 0. Rules that override everything

1. **Cut text.** Every heading is <= 6 words. Every description is one sentence, <= 14 words. No paragraphs in app pages. No helper captions under KPI numbers. No all-caps labels except tiny table column headers.
2. **One accent color** (indigo, section 1). Severity colors appear ONLY inside small pills/dots, never as card backgrounds, never as glows.
3. **No gradients, glows, blur, ping/pulse animations, emoji, or "cyber" green.** The only motion: a 6px "Live" dot with a slow 2s opacity fade, 120ms hover transitions, 160ms drawer slide.
4. **Borders not shadows.** 1px hairline borders; no drop shadows except the drawer and menus.
5. **Remove the current look entirely:** the `cyber.*` colors, `radar-glow`, `alert-glow-red`, `font-mono` everywhere, `font-extrabold`, rounded-2xl cards, colored icon chips, "SOC", "Honeypot Active", "Canaries Armed" banners.
6. **Icons:** lucide-react only, 16px, stroke 1.5 (`strokeWidth={1.5}`), neutral gray. Never colored icon tiles.
7. **No mock data.** Every number, row, chart and chip comes from `/api/*` or the canary library. If there is nothing, show the real empty state (section 5.9). Never show fake placeholders or sample rows. No skeletons that look like data (use a plain 1px spinner line or "Loading").
8. **Do NOT change bait content.** `/docs`, `/readme`, `/llms.txt`, `/robots.txt`, `/mcp`, `/.well-known/*`, `/c/[canaryId]`, `/api/decoy/*` keep their text, hidden injections and canary IDs byte for byte. Those pages may receive a *wrapper-only* restyle (fonts/colors/spacing around the content) but every canary string, hidden element, HTML comment, zero-width char and alt text must remain. Verify with `tests/` and a before/after diff of the rendered HTML text content.
9. Do not edit `src/lib/canaries.ts` or the MCP route for styling reasons. Teammates are editing them; section 7 bug (b) touches the MCP route, so rebase on their changes first (`git diff`/read the file fresh).

## 1. Design tokens

Dark theme only (set `<html class="dark">`; no theme toggle). Define as CSS variables in `globals.css` and map in `tailwind.config.js` (replace `cyber`, `surface`, `background`).

### Colors
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0B0E` | page background |
| `--bg-subtle` | `#0F1115` | sidebar, table header, drawer |
| `--surface` | `#13151A` | cards, inputs |
| `--surface-hover` | `#181B21` | row/button hover |
| `--border` | `#1F2229` | default hairline |
| `--border-strong` | `#2B2F38` | input hover, focused containers |
| `--text` | `#EDEEF0` | primary text |
| `--text-muted` | `#9BA1AE` | secondary text |
| `--text-faint` | `#6B7280` | tertiary, column headers, timestamps |
| `--accent` | `#5B6CFF` | primary button, active nav marker, links, focus ring |
| `--accent-hover` | `#6F7EFF` | button hover |
| `--accent-text` | `#8C9BFF` | accent text on dark |
| `--accent-bg` | `rgba(91,108,255,0.12)` | active nav bg, selected row |

Severity (pills and dots only):
| Severity | Text | Bg (12% alpha) | Dot |
|---|---|---|---|
| critical | `#FF6369` | `rgba(255,99,105,.12)` | `#FF6369` |
| high | `#FF9B52` | `rgba(255,155,82,.12)` | `#FF9B52` |
| medium | `#F5C451` | `rgba(245,196,81,.12)` | `#F5C451` |
| low | `#6CB6FF` | `rgba(108,182,255,.12)` | `#6CB6FF` |
| info | `#9BA1AE` | `rgba(155,161,174,.10)` | `#6B7280` |
Success/live: `#3DD68C`.

### Type
Fonts: **Geist Sans** + **Geist Mono** via the `geist` npm package (`import { GeistSans } from 'geist/font/sans'`, `GeistMono` from `geist/font/mono`), applied on `<body>` with `font-sans`. Fallback: Inter via `next/font/google`. Add `font-feature-settings: "cv11","ss01"` only if Inter. `-webkit-font-smoothing: antialiased`. `font-variant-numeric: tabular-nums` on all numbers/tables.
Mono is used ONLY for: IDs, IPs, endpoints, canary IDs, JSON in the drawer. Never for labels/nav/buttons.

| Role | Size / line-height / weight / tracking |
|---|---|
| Display (landing h1) | 56/60, 600, -0.03em (40/44 under 640px) |
| H1 (page title) | 20/28, 600, -0.01em |
| H2 (section title) | 14/20, 600 |
| Body | 14/20, 400 |
| Body large (landing subhead) | 18/28, 400, `--text-muted` |
| Small / table cell | 13/20, 400 |
| Caption / column header | 12/16, 500, `--text-faint` (column headers: normal case, no uppercase) |
| KPI number | 28/32, 600, -0.02em |

### Spacing, radius, layout
- 4px base scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Radius: **6px** buttons/inputs/pills-rect, **8px** cards/drawer/menus, **999px** only for status pills and the Live chip.
- Control heights: button/input 32px (landing CTAs 40px). Table row 40px. Nav item 32px. Top bar 48px.
- Page content: dashboard max width none, padding 24px; landing max width 1120px, section padding 96px vertical (64px on mobile).
- Focus ring: `outline: 2px solid var(--accent); outline-offset: 2px` on all interactive elements.
- Scrollbars: 8px, thumb `--border-strong`, transparent track.

## 2. Components (build in `src/components/ui/`)

- **Logo**: `<Logo />` renders `/logo-mark.svg` inline (24px in app, 20px in sidebar) + "AgentPot" in Geist 600, 15px, `--text`. Use `public/logo.svg` for og/readme.
- **Button**: variants `primary` (bg `--accent`, white text, hover `--accent-hover`), `secondary` (bg `--surface`, 1px `--border-strong`, text `--text`, hover `--surface-hover`), `ghost` (transparent, text `--text-muted`, hover bg `--surface-hover` + text `--text`). 32px high, 12px x-padding, 13px/500 text, radius 6. Landing size `lg`: 40px, 16px padding, 14px text. No icons inside except a trailing 14px arrow on the hero primary.
- **Card**: bg `--surface`, 1px `--border`, radius 8, padding 16. No header icons. Optional header row: H2 left, muted action right.
- **KPI tile**: Card padding 16; caption on top (12px muted), number below (28px). Optional trailing delta text 12px (`--text-faint`) only when real previous-period data exists; otherwise omit.
- **Badge/Pill**: height 20px, padding 0 8px, 12px/500, radius 999, bg and text from severity table, with a 6px dot to the left of the label. Same component for event type but neutral: bg `rgba(255,255,255,.05)`, text `--text-muted`, no dot.
- **Table**: no outer card padding; container 1px `--border`, radius 8, overflow hidden. Header row 36px, bg `--bg-subtle`, caption style. Rows 40px, 1px bottom border `--border`, hover `--surface-hover`, selected `--accent-bg`. Cell padding 0 12px. Right-align numbers and time. Truncate long cells with ellipsis (max 1 line). No zebra striping.
- **Sidebar**: width 220px (collapses to a 48px icon rail below 1024px, hidden behind a menu button below 640px). bg `--bg-subtle`, right border `--border`. Top: logo (height 48, padding 0 16). Nav items: 16px icon + label, 13px/500, `--text-muted`; hover bg `--surface-hover`; active: text `--text`, bg `--accent-bg`, 2px `--accent` bar at left edge. Bottom: "Sign out" ghost item.
- **Top bar**: 48px, bottom border `--border`, bg `--bg`. Left: page title (H1 20px is replaced by 14px/600 breadcrumb-like title). Right: Live chip, then a 32px search input (only on Events/Sessions pages).
- **Live chip**: pill, `--surface`, 1px border, 6px `#3DD68C` dot (2s opacity fade) + "Live" 12px. When the last poll failed: dot `#FF6369`, text "Offline".
- **Input**: 32px, bg `--surface`, 1px `--border-strong`, radius 6, 13px text, placeholder `--text-faint`, focus ring accent. Select/filter chips: same style.
- **Drawer** (session detail): right-side, 480px wide (100% under 640px), bg `--bg-subtle`, left border `--border`, shadow `0 0 0 1px #000, 0 24px 48px rgba(0,0,0,.5)`, backdrop `rgba(0,0,0,.4)` with no blur. Close on Esc, backdrop click, X button.
- **Empty state**: centered in the container, 48px vertical padding, 16px muted icon (no color), one 14px/500 title, one 13px muted sentence, optional single secondary button. See 5.9.
- **Tabs/segmented filter**: text buttons 13px/500, `--text-muted`, active `--text` with 2px bottom border `--accent`. Used for severity filter.

## 3. Information architecture

Public (marketing) and app are separate.

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Admin sign in |
| `/dashboard` | Overview |
| `/dashboard/events` | Full live event stream |
| `/dashboard/sessions` | Session list (drill-in drawer) |
| `/dashboard/canaries` | Canary library hits + planted keys |
| decoys | unchanged routes (restyle wrapper only) |

Implementation: `src/app/dashboard/layout.tsx` renders sidebar + top bar and a client `DashboardDataProvider` that polls `/api/events?limit=150`, `/api/sessions?limit=50`, `/api/stats` every 4s (pause when `document.hidden`). Pages consume it via a hook. Delete the six-tab `DashboardClient.tsx` after splitting it into the pages and components below (target: no file over 250 lines). Sidebar items (icon, label): `LayoutGrid` Overview, `Activity` Events, `Users` Sessions, `Flag` Canaries. Four items total. If splitting is too risky, an acceptable fallback is one page with these four views switched via `?view=` but the sidebar layout is still required.

## 4. Landing page `/`

Server component, static copy only except the live counters (omit counters if no data). Sticky header 56px, bg `rgba(10,11,14,.8)` with 1px bottom border (no blur).

**Header:** Logo left. Right: ghost links `Docs` (`/docs`), `Sign in` (`/login`); primary small button `Open dashboard` (`/dashboard`). Nothing else. Remove links to /llms.txt, /mcp, /readme from the nav (they stay reachable, they are bait).

**Hero** (centered, max width 720, padding-top 128, bottom 96):
- Eyebrow: none.
- H1 (display): `See what AI agents do when no one is watching.`
- Subhead: `AgentPot lures autonomous agents into decoys and records every move.`
- CTAs: primary lg `Open dashboard` (to `/dashboard`), secondary lg `View decoy docs` (to `/docs`).
- Below, 64px gap: the hero diagram (next). The events API is admin-only and must stay that way, so the landing page shows NO event feed and NO fabricated screenshot.

**Hero diagram** (SVG/CSS, 960x200, 1px lines, `--border-strong`): three nodes connected by a thin line with a small `--accent` dot at the midpoint of each connector:
`Agent` -> `Decoys` -> `AgentPot`. Node = 8px-radius card, label 13px/500, sublabel 12px muted: `Agent` / `Any MCP client or crawler`; `Decoys` / `Tools, pages, keys`; `AgentPot` / `Classify and record`. Static, no animation.

**Features** (section title H2 centered 32/40 600: `Built to catch what logs miss.`; 3 tiles in a row, 24px gap, each Card padding 24, 16px neutral icon, title 14/600, one-sentence 14px muted, nothing else):
1. `Decoy MCP server` / `Tempting tools that never execute anything.`
2. `Injection canaries` / `Hidden instructions with unique IDs trace every hijack.`
3. `Live classification` / `Every request is typed, scored and grouped by agent.`

**How it works** (H2 `How it works`; 3 columns, each: a 12px muted step number `01`, title 14/600, one muted sentence; separated by 1px vertical borders on desktop, stacked on mobile):
1. `01 Plant` / `Decoys and canaries sit where agents look.`
2. `02 Capture` / `Agents touch them. Each hit is logged.`
3. `03 Review` / `Sessions and severity appear on your dashboard.`

**CTA band** (centered, 96px padding, top border): H2 `Start watching.` + primary lg `Open dashboard`.

**Footer** (64px, top border, 13px `--text-faint`, flex between): left `AgentPot`; right links `Docs`, `Sign in`. Nothing else. No version, no badges, no "built with".

Remove everything else from the current landing page: the decoy fleet grid, canary counts, protocol badges, "Never executes outbound commands" banner.

Mobile: stack features and steps in one column; H1 40px; header hides `Docs`.

## 5. App pages

All app text 13px unless noted. No page may show more than: KPI row + one chart + one table (Overview).

### 5.1 `/login`
Full-height, bg `--bg`, centered column width 360. Top: logo mark 32px, centered. H1 `Sign in to AgentPot` (20px, centered). 24px gap. Single Card (padding 24): label `Password` (12px muted), input (type password, autofocus), full-width primary button `Continue` (shows `Signing in…` + disabled while loading). Error: 12px `#FF6369` text under the input, no banner box: `Incorrect password.` for 401, otherwise `Something went wrong. Try again.` Below card, 12px faint centered link `Back to home`. Remove the terminal/"Admin Passcode" info box, the key icons and all uppercase labels. Keep behavior: POST `/api/auth/login`, redirect to `from` param or `/dashboard`.

### 5.2 App shell
Sidebar + top bar (section 2). Top bar title = current page name. Live chip right.

### 5.3 Overview `/dashboard`
Top to bottom, 24px gaps:
1. **KPI row**, 4 tiles, equal width (2x2 under 768px): `Events` (total in window), `Sessions`, `Canary hits` (`injection_fired` + `credential_use`), `Critical` (count with severity critical). Caption 12px, number 28px, nothing else. Window = last 24h unless stats API is all-time; label caption accordingly (`Events · 24h`). Use the real value from `/api/stats`; show `0` when zero.
2. **Activity** card (H2 `Activity`, right: muted `Last 24 hours`): a single hand-rolled SVG bar chart, 24 hourly buckets from `stats.timeline`, height 120, bars `--accent` at 70% opacity, current hour full, baseline 1px `--border`, hover tooltip (`HH:00 · N events`). No gridlines, no legend, no axis titles; 3 x-labels (`-24h`, `-12h`, `now`) in 12px faint. Empty state when all buckets are 0 (5.9).
3. Two columns (60/40) of cards:
   - **Recent events** (H2 `Recent events`, right ghost link `View all`): table of the latest 8 events: columns `Time` (relative, e.g. `2m`), `Event` (type badge), `Severity` (pill), `Agent`, `Endpoint` (mono, truncated). Row click opens the session drawer.
   - **Top agents** (H2 `Top agents`): list of up to 5 rows from `agentFamilyCounts`: name left, count right (tabular), and a 2px `--accent` bar beneath at relative width. No icons.

### 5.4 Events `/dashboard/events`
Top: filter row (Tabs for severity: `All`, `Critical`, `High`, `Medium`, `Low`, `Info`; right-aligned: type select `All events` and search input `Search IP, agent, endpoint`). Then one Table, columns: `Time` (absolute `HH:mm:ss`, tooltip full ISO), `Event` (type badge), `Severity` (pill), `Agent`, `Endpoint` (mono), `IP` (mono), `Canary` (mono short ID or `-`). Newest first, cap 150, a muted footer line `Showing N of M` inside the table container. New rows get a 1.5s `--accent-bg` background fade (no slide, no flash color). Row click opens drawer.
Event type display labels: `crawl` -> `Crawl`, `injection_fired` -> `Injection`, `tool_call` -> `Tool call`, `credential_use` -> `Credential`, `exfil_attempt` -> `Exfiltration`, and (new, see 7b) `mcp_connect` -> `MCP connect`, `tool_discovery` -> `Tool discovery`.

### 5.5 Sessions `/dashboard/sessions`
Search input top right. Table columns: `Agent` (family + 12px faint UA below, truncated), `Risk` (score 0-100 shown as number + 48px x 4px bar; bar color from severity thresholds: >=75 critical, >=50 high, >=25 medium, else low), `Events` (right-aligned), `First seen`, `Last seen` (relative). Sort by last seen. Row click opens drawer.

### 5.6 Session drawer
Header: agent family (14/600), below: session ID (mono 12 faint, copy button 16px ghost icon), close X. Meta grid (2 columns, 12px caption + 13px value): `IP`, `First seen`, `Last seen`, `Events`, `Risk`, `User agent` (full width, wraps). Then H2 `Timeline`: vertical list, 1px left rule `--border-strong`, each event = 6px dot (severity color) on the rule + line: time (12 faint) · type label · severity pill; second line mono 12 muted endpoint. Clicking an event expands (chevron) an inset code block: `<pre>` mono 12px, bg `--bg`, 1px border, radius 6, max-height 240 scroll, showing pretty-printed `payload` (and canary ID if present). Headers collapsed under a `Headers` expander. No data = real empty state `No events in this session.`

### 5.7 Canaries `/dashboard/canaries`
Section 1, H2 `Injection canaries`: Table from `CANARY_LIBRARY` (static, real) joined to hit counts from stats: columns `Name`, `Technique` (neutral badge, humanized: `Hidden text`, `HTML comment`, `Markdown`, `Zero-width`, `Alt text`, `System override`, `Credential leak`), `Location` (mono), `Hits` (right-aligned number, `0` is shown in `--text-faint`), `Last hit` (relative or `-`). Row click filters Events by that canary (`/dashboard/events?canary=<id>`; implement the query param in the Events filter).
Section 2, H2 `Planted keys`: same table style, columns `Key name`, `Location`, `Uses`, `Last use`. NEVER render a key value in full; show the first 6 chars + `…` (they are canary values, but the UI should not teach copying them).
Remove the "success rate" bars/percent math; plain Hits counts only.

### 5.8 Decoy pages (`/docs`, `/readme`)
Wrapper restyle only: max width 720, `--bg`, Geist, h1 28/36 600, body 15/26 `--text-muted`, code blocks `--surface` + 1px border, links `--accent-text`. They should look like a plausible, clean product documentation page. Keep all hidden bait, comments and canary links exactly as is. `/llms.txt`, `/robots.txt`, `/mcp`, `/.well-known/*` are non-HTML: untouched.

### 5.9 Empty and error states (all real)
| Where | Title | Sentence |
|---|---|---|
| Overview chart (no events) | `No activity yet` | `Events appear here as agents reach your decoys.` |
| Events table (none) | `No events yet` | `Point an agent at your decoys to get started.` + secondary button `View decoy docs` (`/docs`) |
| Events table (filters match nothing) | `No matching events` | `Try a different filter.` + ghost `Clear filters` |
| Sessions | `No sessions yet` | `Sessions are created on the first request from an agent.` |
| Top agents (none) | `No agents yet` | (no sentence) |
| Drawer | `No events in this session.` | |
| Fetch failure | `Couldn't load data` | `Retrying…` (auto-retry on next poll) |
KPI tiles show real `0`, never dashes or fake numbers.

### 5.10 Responsive and a11y
Breakpoints 640 / 1024. Tables scroll horizontally inside their container on small screens (hide `IP` and `Canary` columns below 768px). All interactive elements keyboard reachable, visible focus ring, `aria-label` on icon buttons, table rows clickable via `role="button" tabIndex=0` + Enter. Text contrast >= 4.5:1 (all token pairs above satisfy this on `--bg`/`--surface`). `prefers-reduced-motion`: disable the live-dot fade and row fade.

## 6. Assets and metadata
Already created (do not redraw): `public/logo.svg` (mark + wordmark, dark bg), `public/logo-light.svg`, `public/logo-mark.svg`, `src/app/icon.svg` (favicon, auto-served by Next). Delete the `icons: { icon: '/favicon.ico' }` line from `layout.tsx` metadata. Metadata: title `AgentPot`, template `%s · AgentPot`, description `Catch what AI agents do when no one is watching.` Add `src/app/opengraph-image.png` is optional; skip it for now. Logo concept: an open hexagon (the pot) with an eye (ring + pupil) inside and an accent dot at the opening (the lure entering). Colors `#EDEEF0` + `#5B6CFF`.

## 7. Bug fixes (required, ship with the redesign)

### (a) `POST /api/ingest` returns 200 + `event_id` but the row never lands
Cause (verified by reading code): in `recordHoneypotEvent` (`src/lib/supabase/server.ts`), the Supabase `events` insert has a foreign key `canary_id -> canaries(id)`. A self-reported `canary_id` that isn't in the `canaries` table violates the FK; `error` is returned but never logged, the function falls through to the in-memory store (lost on serverless) and `/api/ingest` still answers `success: true`. Same silent failure applies to session insert errors.
Fix:
1. Log every Supabase error (`console.error('events insert failed', error.code, error.message)`); never swallow them.
2. In `/api/ingest`, only pass `canaryId` if it exists in the canary library (`CANARY_LIBRARY` or `PLANTED_CREDENTIALS`) otherwise store `payload.reported_canary_id = body.canary_id` and `canary_id = null`.
3. If the DB insert fails with Supabase configured, `recordHoneypotEvent` must return an error flag (e.g. `{ persisted: false }`) and `/api/ingest` must respond `500 { error: 'Event not stored' }` instead of 200. Only claim success when the row is really inserted. Keep the in-memory fallback only when Supabase env vars are absent.
4. Also check the session `insert`/`update` results the same way (check `.error`).
5. Add a vitest in `tests/ingest-auth.test.ts` (or new file) covering an unknown `canary_id` (row stored, `canary_id` null, `reported_canary_id` set).

### (b) MCP `initialize` and `tools/list` logged as plain `crawl`
In `src/app/mcp/route.ts` both cases call `recordHoneypotEvent({ eventType: 'crawl' })`. Fix:
1. Add two event types: `mcp_connect` (initialize) and `tool_discovery` (tools/list). Update `EventType` in `src/lib/types.ts`, the `event_type` check constraint via a NEW migration `supabase/migrations/<timestamp>_mcp_event_types.sql` (`alter table public.events drop constraint events_event_type_check; alter table public.events add constraint events_event_type_check check (event_type in ('crawl','injection_fired','tool_call','credential_use','exfil_attempt','mcp_connect','tool_discovery'));`). Apply it to the Supabase project (ref `ebrjilipdbbaiimksxas`) and confirm the constraint name first with `select conname from pg_constraint where conrelid='public.events'::regclass`.
2. Severity (`calculateEventSeverity` in `src/lib/session.ts`): `mcp_connect` -> `low`, 3 points; `tool_discovery` -> `low`, 5 points. (They are agent-intent signals, more than a crawl at `info`.)
3. Add both keys to `eventTypeCounts` in `getTelemetryStats`.
4. `GET /mcp` stays `crawl`.
5. UI labels in 5.4. Update `tests/mcp-decoy.test.ts` expectations accordingly.
6. The Decoy Builder is adding tool-description canaries to the same file: read it fresh before editing and make a minimal edit.

## 8. Acceptance checklist
- [ ] Landing page fits: headline, subhead, 2 buttons, diagram, 3 tiles, 3 steps, CTA, footer. Total visible copy under ~120 words.
- [ ] No `font-mono` outside IDs/IPs/endpoints/JSON. No colored icon chips. No glow. No gradient.
- [ ] Only accent + severity colors present (grep for `emerald|cyan|purple|amber|slate-` classes in `src/app` and `src/components` returns nothing except severity pills defined by the tokens).
- [ ] Sidebar has 4 items; dashboard has no six-tab bar.
- [ ] Empty database renders the real empty states; there is no seeded or fake data anywhere.
- [ ] Bait pages: canary strings identical to before (compare with `git diff` or a script; `tests/` pass).
- [ ] `npm test` passes, `npm run build` passes, no TypeScript errors.
- [ ] Login works with the admin password; `/api/events`, `/api/stats`, `/api/sessions` still require the admin cookie.
- [ ] Lighthouse accessibility >= 95 on `/` and `/login` (optional but preferred).
- [ ] Redeploy to Vercel is done by the Honeypot Lead, not the implementer.
