import { describe, it, expect } from 'vitest';
import {
  classifyLureHit,
  isRepeatCredentialUse,
  linkScanClusters,
  LINK_SCANNER_FAMILY,
} from '@/lib/classifier';
import { calculateEventSeverity, scoreEvents } from '@/lib/session';
import { detectAgentFamily } from '@/lib/agent-detector';

describe('link scan classifier', () => {
  it('treats a tight burst of distinct lure links as a link scan', () => {
    const t0 = new Date('2026-11-15T17:33:24.350Z');
    const recent = [
      { source_endpoint: '/mcp', created_at: new Date(t0.getTime()).toISOString() },
      { source_endpoint: '/c/aaa', created_at: new Date(t0.getTime() + 10).toISOString() },
    ];
    const result = classifyLureHit({
      path: '/c/bbb',
      recent,
      at: new Date(t0.getTime() + 20),
    });
    expect(result.eventType).toBe('link_scan');
    expect(result.familyOverride).toBe(LINK_SCANNER_FAMILY);
  });

  it('keeps isolated lure hits as injection_fired', () => {
    const result = classifyLureHit({
      path: '/c/aaa',
      recent: [],
      at: new Date('2026-11-15T17:33:24.350Z'),
    });
    expect(result.eventType).toBe('injection_fired');
  });

  it('does not merge lure hits when a reading gap is longer than the scan window', () => {
    const t0 = new Date('2026-11-15T18:15:43.958Z');
    const recent = [
      { source_endpoint: '/mcp', created_at: t0.toISOString() },
      { source_endpoint: '/c/aaa', created_at: new Date(t0.getTime() + 7000).toISOString() },
    ];
    const result = classifyLureHit({
      path: '/c/bbb',
      recent,
      at: new Date(t0.getTime() + 7200),
    });
    // only two lure links in the tight group (/c/aaa and /c/bbb); /mcp is outside the gap
    expect(result.eventType).toBe('injection_fired');
  });

  it('clusters hits that stay within about two seconds of each other', () => {
    const t0 = new Date('2026-11-15T18:24:53.487Z');
    const recent = [
      { source_endpoint: '/c/7fcc9ee4da2e', created_at: t0.toISOString() },
      { source_endpoint: '/openapi/7fcc9ee4da2e.yaml', created_at: new Date(t0.getTime() + 1200).toISOString() },
      { source_endpoint: '/c/02138453bf2a', created_at: new Date(t0.getTime() + 2300).toISOString() },
    ];
    const clusters = linkScanClusters(recent);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });

  it('logs /status health-check hits as lure_followed, not injection_fired', () => {
    const result = classifyLureHit({
      path: '/status/0fabf5cda418',
      canaryId: 'canary-resource-14',
      recent: [
        { source_endpoint: '/c/aaa', created_at: '2026-11-15T19:41:05.000Z' },
        { source_endpoint: '/c/bbb', created_at: '2026-11-15T19:41:05.500Z' },
      ],
      at: new Date('2026-11-15T19:41:06.000Z'),
    });
    expect(result.eventType).toBe('lure_followed');
  });

  it('still flags exfil payloads as exfil_attempt', () => {
    const result = classifyLureHit({
      path: '/c/aaa',
      isExfil: true,
      recent: [],
    });
    expect(result.eventType).toBe('exfil_attempt');
  });
});

describe('credential use severity', () => {
  it('scores the first use of a key as high and repeats in the same session as info', () => {
    const first = calculateEventSeverity('credential_use', { isRepeatCredential: false });
    const repeat = calculateEventSeverity('credential_use', { isRepeatCredential: true });
    expect(first).toEqual({ severity: 'high', scorePoints: 35 });
    expect(repeat).toEqual({ severity: 'info', scorePoints: 2 });

    const prior = [{ event_type: 'credential_use', payload: { matched_credential: 'key-a' } }];
    expect(isRepeatCredentialUse(prior, { matched_credential: 'key-a' })).toBe(true);
    expect(isRepeatCredentialUse(prior, { matched_credential: 'key-b' })).toBe(false);

    // 35+2+35 would be 72, but a key-only session is capped at 40.
    expect(
      scoreEvents([
        { event_type: 'credential_use', payload: { matched_credential: 'key-a', method: 'initialize' } },
        { event_type: 'credential_use', payload: { matched_credential: 'key-a', method: 'tools/list' } },
        { event_type: 'credential_use', payload: { matched_credential: 'key-b', method: 'initialize' } },
      ])
    ).toBe(40);
  });

  it('keeps read_secrets tool calls high', () => {
    expect(calculateEventSeverity('tool_call', { toolName: 'read_secrets' })).toEqual({
      severity: 'high',
      scorePoints: 30,
    });
  });

  it('scores lure_followed as low and link_scan as info', () => {
    expect(calculateEventSeverity('lure_followed')).toEqual({ severity: 'low', scorePoints: 5 });
    expect(calculateEventSeverity('link_scan')).toEqual({ severity: 'info', scorePoints: 2 });
  });
});

describe('agentwebmap-bot family', () => {
  it('classifies agentwebmap-bot as an AI crawler, not Generic', () => {
    const result = detectAgentFamily('Mozilla/5.0 (compatible; agentwebmap-bot/1.0)');
    expect(result.family).toBe('AgentWebMap (AI crawler)');
    expect(result.isLikelyAiAgent).toBe(true);
    expect(result.family).not.toContain('Generic');
  });
});
