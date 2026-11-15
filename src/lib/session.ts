import crypto from 'crypto';
import { EventSeverity, EventType } from './types';
import { EVENT_TYPES } from './event-copy';

export const SESSION_RELINK_WINDOW_MS = 6 * 60 * 60 * 1000;

const EVENT_TYPE_ALIASES: Record<string, EventType> = {
  injection: 'injection_fired',
  prompt_injection: 'injection_fired',
  canary_hit: 'injection_fired',
  injection_hit: 'injection_fired',
  canary: 'injection_fired',
  credential: 'credential_use',
  credentials: 'credential_use',
  credential_used: 'credential_use',
  key_use: 'credential_use',
  exfil: 'exfil_attempt',
  exfiltration: 'exfil_attempt',
  tool: 'tool_call',
  tools: 'tool_call',
  toolcall: 'tool_call',
  mcp_tool: 'tool_call',
  initialize: 'mcp_connect',
  mcp_initialize: 'mcp_connect',
  mcp_init: 'mcp_connect',
  connect: 'mcp_connect',
  tools_list: 'tool_discovery',
  tool_list: 'tool_discovery',
  list_tools: 'tool_discovery',
  discovery: 'tool_discovery',
  page_read: 'crawl',
};

export function normalizeEventType(raw: unknown): EventType | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if ((EVENT_TYPES as readonly string[]).includes(s)) return s as EventType;
  return EVENT_TYPE_ALIASES[s] ?? null;
}

export function isTestRequest(
  headers?: Record<string, string> | null,
  payload?: Record<string, unknown> | null
): boolean {
  if (headers) {
    const raw =
      headers['x-agentpot-test'] ??
      headers['X-AgentPot-Test'] ??
      headers['x-agentpot-test'.toLowerCase()];
    if (raw != null && String(raw).trim() !== '') {
      const v = String(raw).trim().toLowerCase();
      if (v !== '0' && v !== 'false' && v !== 'no') return true;
    }
  }
  if (payload) {
    const flag = (payload as { is_test?: unknown }).is_test;
    if (flag === true || flag === 1 || flag === '1' || flag === 'true') return true;
  }
  return false;
}

export function isGenericFamily(family?: string | null): boolean {
  if (!family) return true;
  const n = family.trim().toLowerCase();
  return n === '' || n === 'unknown' || n === 'generic / unknown agent';
}

export function preferAgentFamily(
  existing?: string | null,
  detected?: string | null
): string {
  const next = (detected || '').trim();
  const prev = (existing || '').trim();
  if (!prev || isGenericFamily(prev)) return next || 'Generic / Unknown Agent';
  if (!next || isGenericFamily(next)) return prev;
  return prev;
}

export function sessionIdFromHeaders(headers: Record<string, string>): string | null {
  const clientSession =
    headers['mcp-session-id'] ||
    headers['x-session-id'] ||
    headers['x-agent-session'] ||
    headers['x-mcp-session-id'];

  if (clientSession && typeof clientSession === 'string' && clientSession.trim()) {
    const trimmed = clientSession.trim().slice(0, 48);
    if (trimmed.startsWith('sess_')) return trimmed;
    return `sess_${trimmed}`;
  }
  return null;
}

export function fallbackSessionId(
  userAgent: string,
  options?: { isTest?: boolean; at?: Date }
): string {
  const at = options?.at ?? new Date();
  const bucket = Math.floor(at.getTime() / SESSION_RELINK_WINDOW_MS);
  const rawKey = `${options?.isTest ? 'test' : 'live'}:ua:${userAgent || 'unknown'}:w${bucket}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  return options?.isTest ? `sess_test_${hash}` : `sess_${hash}`;
}

/**
 * Deterministic session id from MCP/client hints or UA within a time window.
 * IP is not part of the key (Cloudflare egress IPs rotate). Prefer
 * resolveSessionId in supabase/server.ts, which also relinks to a recent
 * session with the same User-Agent.
 */
export function getOrCreateSessionId(
  headers: Record<string, string>,
  _ip: string,
  userAgent: string,
  options?: { isTest?: boolean }
): string {
  const hinted = sessionIdFromHeaders(headers);
  if (hinted) {
    if (options?.isTest && !hinted.startsWith('sess_test_')) {
      return hinted.replace(/^sess_/, 'sess_test_');
    }
    return hinted;
  }
  return fallbackSessionId(userAgent, { isTest: options?.isTest });
}

export function calculateEventSeverity(
  eventType: EventType,
  details?: {
    toolName?: string;
    canaryId?: string;
    isCredential?: boolean;
    isExfil?: boolean;
    sessionHasInjection?: boolean;
  }
): { severity: EventSeverity; scorePoints: number } {
  if (details?.isExfil || eventType === 'exfil_attempt') {
    return { severity: 'critical', scorePoints: 50 };
  }

  if (eventType === 'credential_use') {
    return { severity: 'high', scorePoints: 35 };
  }

  if (eventType === 'injection_fired') {
    return { severity: 'high', scorePoints: 40 };
  }

  if (eventType === 'tool_call') {
    const tool = details?.toolName?.toLowerCase() || '';
    if (tool === 'run_shell' || tool.includes('shell') || tool.includes('exec')) {
      return { severity: 'critical', scorePoints: 45 };
    }
    if (tool === 'transfer_funds' || tool.includes('transfer')) {
      return { severity: 'critical', scorePoints: 45 };
    }
    if (tool === 'read_secrets' || tool.includes('secret')) {
      return { severity: 'high', scorePoints: 30 };
    }
    if (details?.sessionHasInjection) {
      return { severity: 'high', scorePoints: 30 };
    }
    if (tool === 'send_email' || tool === 'fetch_url') {
      return { severity: 'medium', scorePoints: 20 };
    }
    return { severity: 'medium', scorePoints: 15 };
  }

  if (eventType === 'mcp_connect') {
    return { severity: 'low', scorePoints: 3 };
  }

  if (eventType === 'tool_discovery') {
    return { severity: 'low', scorePoints: 5 };
  }

  if (eventType === 'crawl') {
    return { severity: 'info', scorePoints: 2 };
  }

  return { severity: 'low', scorePoints: 5 };
}

export function computeSessionSeverityScore(currentScore: number, addedPoints: number): number {
  return Math.min(100, Math.max(0, currentScore + addedPoints));
}

export function scoreEvents(
  events: Array<{ event_type: EventType; payload?: Record<string, unknown> | null }>
): number {
  let score = 0;
  let sessionHasInjection = false;
  for (const event of events) {
    if (event.event_type === 'injection_fired') {
      sessionHasInjection = true;
    }
    const toolName =
      (typeof event.payload?.tool === 'string' && event.payload.tool) ||
      (typeof event.payload?.toolName === 'string' && event.payload.toolName) ||
      undefined;
    const { scorePoints } = calculateEventSeverity(event.event_type, {
      toolName,
      sessionHasInjection: event.event_type === 'tool_call' ? sessionHasInjection : false,
    });
    // An injection_fired in this same event should still mark the session for later tools.
    if (event.event_type === 'injection_fired') sessionHasInjection = true;
    score = computeSessionSeverityScore(score, scorePoints);
  }
  return score;
}
