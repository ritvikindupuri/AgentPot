import { describe, it, expect } from 'vitest';
import { isSensitiveHeaderName, sanitizeHeaders, headersContainOidcToken } from '@/lib/headers';
import { toDisplayRecord } from '@/lib/display-record';
import { EVENT_TYPES, EVENT_TYPE_COPY, eventScorePoints } from '@/lib/event-copy';
import { calculateEventSeverity } from '@/lib/session';
import { EventType } from '@/lib/types';

describe('sanitizeHeaders', () => {
  it('strips Vercel platform secrets, auth cookies, and token-bearing headers', () => {
    const cleaned = sanitizeHeaders({
      'user-agent': 'Mozilla/5.0',
      accept: 'application/json',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'x-forwarded-host': 'agentpot-app.vercel.app',
      'x-forwarded-proto': 'https',
      forwarded: 'for=203.0.113.10;sig=should-not-keep',
      'x-forwarded-authorization': 'Bearer should-not-keep',
      authorization: 'Bearer secret-token',
      cookie: 'session=abc',
      'set-cookie': 'session=abc',
      'x-vercel-oidc-token': 'eyJhbGciOiFAKE',
      'x-vercel-sc-headers': '{"authorization":"Bearer x"}',
      'x-vercel-proxy-signature': 'sig',
      'x-vercel-id': 'id',
      'x-api-key': 'key',
      'x-agent-key': 'ingest',
    });

    expect(cleaned['user-agent']).toBe('Mozilla/5.0');
    expect(cleaned.accept).toBe('application/json');
    expect(cleaned['content-type']).toBe('application/json');
    expect(cleaned['x-forwarded-for']).toBe('203.0.113.10');
    expect(cleaned['x-forwarded-host']).toBe('agentpot-app.vercel.app');
    expect(cleaned['x-forwarded-proto']).toBe('https');
    expect(cleaned.forwarded).toBeUndefined();
    expect(cleaned.authorization).toBeUndefined();
    expect(cleaned.cookie).toBeUndefined();
    expect(cleaned['set-cookie']).toBeUndefined();
    expect(cleaned['x-forwarded-authorization']).toBeUndefined();
    expect(cleaned['x-api-key']).toBeUndefined();
    expect(cleaned['x-agent-key']).toBeUndefined();
    for (const key of Object.keys(cleaned)) {
      expect(key.toLowerCase().startsWith('x-vercel-')).toBe(false);
    }
    expect(headersContainOidcToken(cleaned)).toBe(false);
  });

  it('treats all x-vercel-* names as sensitive', () => {
    expect(isSensitiveHeaderName('x-vercel-oidc-token')).toBe(true);
    expect(isSensitiveHeaderName('X-Vercel-SC-Headers')).toBe(true);
    expect(isSensitiveHeaderName('user-agent')).toBe(false);
    expect(isSensitiveHeaderName('accept')).toBe(false);
  });
});

describe('toDisplayRecord', () => {
  it('parses a truncated preview string instead of showing escaped JSON', () => {
    const inner = { file: 'llms.txt', method: 'GET' };
    const rec = toDisplayRecord({
      _truncated: true,
      _original_bytes: 9000,
      preview: JSON.stringify(inner),
    });
    expect(rec.truncatedBytes).toBe(9000);
    expect(rec.rows).toEqual([
      { key: 'file', value: 'llms.txt' },
      { key: 'method', value: 'GET' },
    ]);
    expect(JSON.stringify(rec.rows)).not.toContain('\\"file\\"');
  });
});

describe('event type dictionary', () => {
  it('covers every EventType and matches calculateEventSeverity points', () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_TYPE_COPY[type].label).toBeTruthy();
      expect(EVENT_TYPE_COPY[type].description).toBeTruthy();
    }
    const cases: Array<{ type: EventType; tool?: string }> = [
      { type: 'crawl' },
      { type: 'injection_fired' },
      { type: 'credential_use' },
      { type: 'exfil_attempt' },
      { type: 'mcp_connect' },
      { type: 'tool_discovery' },
      { type: 'tool_call', tool: 'send_email' },
      { type: 'tool_call', tool: 'fetch_url' },
      { type: 'tool_call', tool: 'read_secrets' },
      { type: 'tool_call', tool: 'run_shell' },
      { type: 'tool_call', tool: 'transfer_funds' },
      { type: 'tool_call', tool: 'other' },
    ];
    for (const c of cases) {
      const fromCode = calculateEventSeverity(c.type, { toolName: c.tool });
      expect(eventScorePoints(c.type, c.tool)).toBe(fromCode.scorePoints);
    }
  });
});
