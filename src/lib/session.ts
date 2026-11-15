import crypto from 'crypto';
import { EventSeverity, EventType } from './types';

export function getOrCreateSessionId(
  headers: Record<string, string>,
  ip: string,
  userAgent: string
): string {
  // Check for explicit session header from MCP or client
  const clientSession =
    headers['mcp-session-id'] ||
    headers['x-session-id'] ||
    headers['x-agent-session'];

  if (clientSession && typeof clientSession === 'string' && clientSession.trim()) {
    return `sess_${clientSession.trim().slice(0, 48)}`;
  }

  // Generate deterministic daily session ID based on IP and User-Agent
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rawKey = `${ip}:${userAgent}:${dateStr}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  return `sess_${hash}`;
}

export function calculateEventSeverity(
  eventType: EventType,
  details?: {
    toolName?: string;
    canaryId?: string;
    isCredential?: boolean;
    isExfil?: boolean;
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
