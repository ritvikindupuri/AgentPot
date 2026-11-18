import { EventSeverity, EventType } from './types';

/** Every EventType in src/lib/types.ts, in one place so the dictionary cannot drift. */
export const EVENT_TYPES = [
  'crawl',
  'injection_fired',
  'tool_call',
  'credential_use',
  'exfil_attempt',
  'mcp_connect',
  'tool_discovery',
  'link_scan',
  'lure_followed',
] as const satisfies readonly EventType[];

export interface EventTypeCopy {
  label: string;
  description: string;
}

export const EVENT_TYPE_COPY = {
  crawl: {
    label: 'Page read',
    description: 'An agent fetched a decoy page.',
  },
  injection_fired: {
    label: 'Injection hit',
    description: 'A planted instruction or canary was followed.',
  },
  tool_call: {
    label: 'Tool call',
    description: 'A decoy MCP tool was invoked.',
  },
  credential_use: {
    label: 'Credential use',
    description: 'A planted credential was presented.',
  },
  exfil_attempt: {
    label: 'Exfil attempt',
    description: 'The caller tried to pull or send data out.',
  },
  mcp_connect: {
    label: 'MCP connect',
    description: 'An MCP client called initialize.',
  },
  tool_discovery: {
    label: 'Tool discovery',
    description: 'An MCP client listed the decoy tools.',
  },
  link_scan: {
    label: 'Link scan',
    description: 'A session hit several distinct lure links in a tight burst, without a reading gap.',
  },
  lure_followed: {
    label: 'Lure followed',
    description: 'A planted health-check or similar follow-up link was requested.',
  },
} as const satisfies Record<EventType, EventTypeCopy>;

export function getEventTypeCopy(type: EventType | string): EventTypeCopy {
  if (type in EVENT_TYPE_COPY) {
    return EVENT_TYPE_COPY[type as EventType];
  }
  return { label: type || 'Unknown', description: 'An unclassified event was recorded.' };
}

export function eventTypeSummary(type: EventType | string): string {
  const copy = getEventTypeCopy(type);
  const desc = copy.description.replace(/\.$/, '');
  const lower = desc.charAt(0).toLowerCase() + desc.slice(1);
  return `${copy.label}: ${lower}`;
}

export const SEVERITY_LEVELS = ['info', 'low', 'medium', 'high', 'critical'] as const satisfies readonly EventSeverity[];

export const SEVERITY_COLORS: Record<EventSeverity, { text: string; bg: string; dot: string }> = {
  critical: { text: '#FF6369', bg: 'rgba(255,99,105,0.12)', dot: '#FF6369' },
  high: { text: '#FF9B52', bg: 'rgba(255,155,82,0.12)', dot: '#FF9B52' },
  medium: { text: '#F5C451', bg: 'rgba(245,196,81,0.12)', dot: '#F5C451' },
  low: { text: '#6CB6FF', bg: 'rgba(108,182,255,0.12)', dot: '#6CB6FF' },
  info: { text: '#9BA1AE', bg: 'rgba(155,161,174,0.10)', dot: '#6B7280' },
};

export interface SeverityCopy {
  label: string;
  meaning: string;
  assignment: string;
}

/**
 * Copy taken from calculateEventSeverity in src/lib/session.ts.
 * Do not invent extra rules here.
 */
export const SEVERITY_COPY = {
  info: {
    label: 'Info',
    meaning: 'A routine fetch of a decoy page, with no tool use or canary hit.',
    assignment:
      'Assigned to page-read (crawl) events and to link-scan bursts, which add 2 points, and to a repeat use of the same planted key in a session, which also adds 2 points.',
  },
  low: {
    label: 'Low',
    meaning: 'An early sign that a client is talking like an agent, beyond a plain page read.',
    assignment:
      'Assigned to MCP connect (initialize, 3 points), tool discovery (tools/list, 5 points), and a followed health-check lure (5 points). Unrecognized event types also land here at 5 points.',
  },
  medium: {
    label: 'Medium',
    meaning: 'A decoy MCP tool was called, but not a high-impact one.',
    assignment:
      'Assigned to tool calls when the session has no prior injection hit: send_email and fetch_url add 20 points; any other tool that is not listed as high or critical adds 15 points.',
  },
  high: {
    label: 'High',
    meaning: 'A planted canary or credential was used, or the agent tried to read secrets.',
    assignment:
      'Assigned to injection hits (40 points), the first use of a given planted key in a session (35 points), a read_secrets tool call or any tool name that includes "secret" (30 points), and any other tool call (including send_email or fetch_url) that follows an injection hit in the same session (30 points).',
  },
  critical: {
    label: 'Critical',
    meaning: 'The agent tried to exfiltrate data, run a shell, or move funds.',
    assignment:
      'Assigned to exfil attempts (50 points) and to tool calls named run_shell, or whose name includes "shell" or "exec", or transfer_funds / "transfer" (45 points).',
  },
} as const satisfies Record<EventSeverity, SeverityCopy>;

export function getSeverityCopy(severity: EventSeverity | string): SeverityCopy {
  const key = (severity || 'info').toLowerCase() as EventSeverity;
  return SEVERITY_COPY[key] ?? SEVERITY_COPY.info;
}

export function severityTooltipText(severity: EventSeverity | string): string {
  const copy = getSeverityCopy(severity);
  return `${copy.meaning} ${copy.assignment}`;
}

/**
 * Explains computeSessionSeverityScore + calculateEventSeverity in src/lib/session.ts.
 */
export const RISK_SCORE_TOOLTIP =
  'A session starts at 0. Each event adds the points for its severity (for example, a page read adds 2 and a shell tool call adds 45). The running total is capped at 100, but 100 is only reachable on real misuse: presenting a planted AWS or OpenAI key, calling the planted AWS endpoint, or following an instruction planted inside a secret. A read_secrets or other tool call without that misuse is capped at 60. A session with no tools/call and no read_secrets is capped at 40.';

export function eventScorePoints(
  eventType: EventType | string,
  toolName?: string,
  sessionHasInjection?: boolean,
  isRepeatCredential?: boolean
): number {
  // Mirror calculateEventSeverity without importing Node crypto from session.ts
  // so this module stays safe to use in the browser. Keep in sync with session.ts.
  const type = eventType as EventType;
  const tool = toolName?.toLowerCase() || '';
  if (type === 'exfil_attempt') return 50;
  if (type === 'credential_use') return isRepeatCredential ? 2 : 35;
  if (type === 'injection_fired') return 40;
  if (type === 'lure_followed') return 5;
  if (type === 'link_scan') return 2;
  if (type === 'tool_call') {
    if (tool === 'run_shell' || tool.includes('shell') || tool.includes('exec')) return 45;
    if (tool === 'transfer_funds' || tool.includes('transfer')) return 45;
    if (tool === 'read_secrets' || tool.includes('secret')) return 30;
    if (sessionHasInjection) return 30;
    if (tool === 'send_email' || tool === 'fetch_url') return 20;
    return 15;
  }
  if (type === 'mcp_connect') return 3;
  if (type === 'tool_discovery') return 5;
  if (type === 'crawl') return 2;
  return 5;
}
