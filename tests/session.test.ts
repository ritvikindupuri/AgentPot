import { describe, it, expect } from 'vitest';
import {
  calculateEventSeverity,
  ensureTestSessionId,
  fallbackSessionId,
  getOrCreateSessionId,
  SESSION_RELINK_WINDOW_MS,
  isGenericFamily,
  isTestRequest,
  normalizeEventType,
  preferAgentFamily,
  scoreEvents,
} from '@/lib/session';
import { eventScorePoints } from '@/lib/event-copy';
import { credentialUseLabel } from '@/lib/supabase/server';
import {
  getRecentEvents,
  getTelemetryStats,
  recordHoneypotEvent,
  resolveSessionId,
} from '@/lib/supabase/server';

describe('event type normalization', () => {
  it('accepts canonical types and common aliases, and rejects unknown names', () => {
    expect(normalizeEventType('tool_call')).toBe('tool_call');
    expect(normalizeEventType('prompt-injection')).toBe('injection_fired');
    expect(normalizeEventType('initialize')).toBe('mcp_connect');
    expect(normalizeEventType('not_a_real_type')).toBeNull();
  });
});

describe('test request flags', () => {
  it('detects X-AgentPot-Test and is_test payload flags', () => {
    expect(isTestRequest({ 'x-agentpot-test': '1' })).toBe(true);
    expect(isTestRequest({}, { is_test: true })).toBe(true);
    expect(isTestRequest({ 'x-agentpot-test': 'false' })).toBe(false);
    expect(isTestRequest({}, { is_test: false })).toBe(false);
  });
});

describe('session linking', () => {
  it('uses MCP session headers and does not include the IP in the fallback key', () => {
    const fromMcp = getOrCreateSessionId(
      { 'mcp-session-id': 'abc-123' },
      '1.1.1.1',
      'curl/8.14.1'
    );
    expect(fromMcp).toBe('sess_abc-123');

    const a = getOrCreateSessionId({}, '1.1.1.1', 'curl/8.14.1');
    const b = getOrCreateSessionId({}, '9.9.9.9', 'curl/8.14.1');
    expect(a).toBe(b);
    expect(a).toBe(fallbackSessionId('curl/8.14.1'));

    const testId = getOrCreateSessionId({}, '1.1.1.1', 'curl/8.14.1', { isTest: true });
    expect(testId).toMatch(/^sess_test_/);
    expect(testId).not.toBe(a);
  });

  it('relinks later requests with the same UA and a different IP to one session', async () => {
    const ua = `session-relink-test-${Date.now()}/1.0`;
    const first = await resolveSessionId({}, '1.1.1.1', ua);
    await recordHoneypotEvent({
      sessionId: first,
      eventType: 'crawl',
      agentFamily: 'CLI Agent / Probe',
      sourceEndpoint: '/robots.txt',
      requestMethod: 'GET',
      ipAddress: '1.1.1.1',
      userAgent: ua,
      headers: {},
    });
    const second = await resolveSessionId({}, '9.9.9.9', ua);
    expect(second).toBe(first);
  });
});

describe('family consistency and event_count', () => {
  it('keeps a specific family when a later event is generic, and recounts events', async () => {
    const ua = `family-count-test-${Date.now()}/1.0`;
    const sessionId = await resolveSessionId({ 'mcp-session-id': `family-${Date.now()}` }, '2.2.2.2', ua);

    await recordHoneypotEvent({
      sessionId,
      eventType: 'mcp_connect',
      agentFamily: 'MCP Client (decoy-check)',
      sourceEndpoint: '/mcp',
      requestMethod: 'POST',
      ipAddress: '2.2.2.2',
      userAgent: ua,
    });
    const second = await recordHoneypotEvent({
      sessionId,
      eventType: 'crawl',
      agentFamily: 'Generic / Unknown Agent',
      sourceEndpoint: '/mcp',
      requestMethod: 'GET',
      ipAddress: '8.8.8.8',
      userAgent: ua,
    });

    expect(second.agent_family).toBe('MCP Client (decoy-check)');
    expect(isGenericFamily(second.agent_family)).toBe(false);

    const { getSessionDetails } = await import('@/lib/supabase/server');
    const details = await getSessionDetails(sessionId);
    expect(details.session?.event_count).toBe(details.events.length);
    expect(details.events.every((event) => event.agent_family === 'MCP Client (decoy-check)')).toBe(true);
  });
});

describe('preferAgentFamily', () => {
  it('upgrades generic session labels and will not downgrade a specific one', () => {
    expect(preferAgentFamily('Generic / Unknown Agent', 'MCP Client (decoy-check)')).toBe(
      'MCP Client (decoy-check)'
    );
    expect(preferAgentFamily('MCP Client (decoy-check)', 'Generic / Unknown Agent')).toBe(
      'MCP Client (decoy-check)'
    );
  });
});

describe('post-injection tool severity', () => {
  it('rates send_email and other follow-on tools high after an injection hit', () => {
    const before = calculateEventSeverity('tool_call', { toolName: 'send_email' });
    expect(before.severity).toBe('medium');
    expect(before.scorePoints).toBe(20);

    const after = calculateEventSeverity('tool_call', {
      toolName: 'send_email',
      sessionHasInjection: true,
    });
    expect(after.severity).toBe('high');
    expect(after.scorePoints).toBe(30);
    expect(eventScorePoints('tool_call', 'send_email', true)).toBe(30);

    const shell = calculateEventSeverity('tool_call', {
      toolName: 'run_shell',
      sessionHasInjection: true,
    });
    expect(shell.severity).toBe('critical');
    expect(scoreEvents([
      { event_type: 'injection_fired', payload: {} },
      { event_type: 'tool_call', payload: { tool: 'send_email' } },
    ])).toBe(70);
  });
});

describe('credential use labels', () => {
  it('uses the planted canary id instead of falling back to unknown', () => {
    expect(
      credentialUseLabel({
        canary_id: 'canary-cred-mcp-04',
        payload: {},
      })
    ).toBe('Decoy MCP Vault Token (read_secrets output)');
    expect(credentialUseLabel({ canary_id: 'canary-cred-aws-01', payload: {} })).toBe(
      'Decoy AWS Admin Access Key'
    );
  });
});

describe('real-agents-only filtering', () => {
  it('excludes X-AgentPot-Test events from dashboard telemetry', async () => {
    const ua = `test-filter-${Date.now()}/1.0`;
    const sessionId = await resolveSessionId(
      { 'x-agentpot-test': '1' },
      '3.3.3.3',
      ua,
      { isTest: true }
    );
    const stored = await recordHoneypotEvent({
      sessionId,
      eventType: 'crawl',
      agentFamily: 'CLI Agent / Probe',
      sourceEndpoint: '/robots.txt',
      requestMethod: 'GET',
      ipAddress: '3.3.3.3',
      userAgent: ua,
      headers: { 'x-agentpot-test': '1' },
      isTest: true,
    });
    expect(stored.persisted).toBe(true);
    expect(stored.is_test).toBe(true);

    const recent = await getRecentEvents(500);
    expect(recent.some((event) => event.id === stored.id)).toBe(false);

    const stats = await getTelemetryStats();
    expect(Object.values(stats.agentFamilyCounts).reduce((a, b) => a + b, 0)).toBe(stats.totalEvents);
  });
});

describe('test events stay off live sessions', () => {
  it('retargets a test event away from a non-test session and marks the test session', async () => {
    const ua = `test-isolation-${Date.now()}/1.0`;
    const liveId = await resolveSessionId({}, '4.4.4.4', ua);
    expect(liveId.startsWith('sess_')).toBe(true);
    expect(liveId.startsWith('sess_test_')).toBe(false);

    await recordHoneypotEvent({
      sessionId: liveId,
      eventType: 'crawl',
      agentFamily: 'CLI Agent / Probe',
      sourceEndpoint: '/docs',
      requestMethod: 'GET',
      ipAddress: '4.4.4.4',
      userAgent: ua,
    });

    const testEvent = await recordHoneypotEvent({
      sessionId: liveId,
      eventType: 'credential_use',
      agentFamily: 'CLI Agent / Probe',
      sourceEndpoint: '/api/v1/secrets',
      requestMethod: 'GET',
      ipAddress: '4.4.4.4',
      userAgent: ua,
      headers: { 'x-agentpot-test': '1' },
      isTest: true,
    });

    expect(testEvent.is_test).toBe(true);
    expect(testEvent.session_id.startsWith('sess_test_')).toBe(true);
    expect(testEvent.session_id).not.toBe(liveId);
    expect(testEvent.session_id).toBe(ensureTestSessionId(liveId, ua));

    const { getSessionDetails } = await import('@/lib/supabase/server');
    const live = await getSessionDetails(liveId);
    expect(live.session?.is_test).toBeFalsy();
    expect(live.events.some((event) => event.id === testEvent.id)).toBe(false);

    const testSession = await getSessionDetails(testEvent.session_id);
    expect(testSession.session?.is_test).toBe(true);
    expect(testSession.events.some((event) => event.id === testEvent.id)).toBe(true);

    const recent = await getRecentEvents(500);
    expect(recent.some((event) => event.id === testEvent.id)).toBe(false);
  });
});

describe('UA inactivity split', () => {
  it('uses a 30-minute inactivity window', () => {
    expect(SESSION_RELINK_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it('relinks the same UA within 30 minutes and starts a new session after 30 minutes idle', async () => {
    const ua = `idle-split-${Date.now()}/1.0`;
    const t0 = new Date();
    const first = await resolveSessionId({}, '5.5.5.5', ua, { isTest: true, at: t0 });
    await recordHoneypotEvent({
      sessionId: first,
      eventType: 'crawl',
      agentFamily: 'CLI Agent / Probe',
      sourceEndpoint: '/robots.txt',
      requestMethod: 'GET',
      ipAddress: '5.5.5.5',
      userAgent: ua,
      isTest: true,
    });

    const within = await resolveSessionId({}, '9.9.9.9', ua, {
      isTest: true,
      at: new Date(t0.getTime() + 29 * 60 * 1000),
    });
    expect(within).toBe(first);

    const after = await resolveSessionId({}, '8.8.8.8', ua, {
      isTest: true,
      at: new Date(t0.getTime() + 31 * 60 * 1000),
    });
    expect(after).not.toBe(first);
    expect(after.startsWith('sess_test_')).toBe(true);
  });

  it('keeps MCP session ids together even after 30 minutes of inactivity', async () => {
    const ua = `mcp-idle-${Date.now()}/1.0`;
    const headers = { 'mcp-session-id': `keep-${Date.now()}` };
    const t0 = new Date();
    const first = await resolveSessionId(headers, '6.6.6.6', ua, { isTest: true, at: t0 });
    const later = await resolveSessionId(headers, '7.7.7.7', ua, {
      isTest: true,
      at: new Date(t0.getTime() + 2 * 60 * 60 * 1000),
    });
    expect(later).toBe(first);
    expect(first.startsWith('sess_test_')).toBe(true);
  });
});

