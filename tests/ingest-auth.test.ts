import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ingest/route';
import { getRecentEvents } from '@/lib/supabase/server';

describe('Ingest API Authentication (/api/ingest)', () => {
  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'injection_fired',
        canary_id: 'canary-hidden-text-01',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Missing API key');
  });

  it('rejects invalid agent API keys with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer invalid_test_key_99999',
      },
      body: JSON.stringify({
        event_type: 'injection_fired',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toContain('Invalid agent API key');
  });

  it('accepts valid agent API keys and ingests self-reported events', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer agy_agent_test_key_valid_2026',
        'user-agent': 'RedTeam-Evaluation-Agent/2.0',
      },
      body: JSON.stringify({
        event_type: 'injection_fired',
        canary_id: 'canary-comment-02',
        agent_name: 'RedTeam-Eval-Runner',
        source_endpoint: '/readme',
        payload: {
          confidence: 0.98,
          trigger: 'HTML comment directive recognized',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.event_id).toBeDefined();
    expect(json.event_type).toBe('injection_fired');
    expect(json.severity).toBe('high');
  });

  it('supports X-Agent-Key header authentication', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agent-key': 'test-agent-key-redteam-01',
      },
      body: JSON.stringify({
        event_type: 'tool_call',
        agent_name: 'RedTeam-Tool-Evaluator',
        payload: {
          tool: 'read_secrets',
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('stores unknown canary_id as reported_canary_id in payload with canary_id null', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer agy_agent_test_key_valid_2026',
        'user-agent': 'RedTeam-Evaluation-Agent/2.0',
      },
      body: JSON.stringify({
        event_type: 'injection_fired',
        canary_id: 'unknown-fake-canary-999',
        agent_name: 'RedTeam-Unknown-Tester',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.event_id).toBeDefined();

    const events = await getRecentEvents(10);
    const storedEvent = events.find((e) => e.id === json.event_id);
    expect(storedEvent).toBeDefined();
    expect(storedEvent?.canary_id).toBeNull();
    expect(storedEvent?.payload?.reported_canary_id).toBe('unknown-fake-canary-999');
  });

  it('strips sensitive request headers before storing the event', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer agy_agent_test_key_valid_2026',
        'user-agent': 'Header-Sanitize-Agent/1.0',
        accept: 'application/json',
        cookie: 'should-not-be-stored=1',
        'x-vercel-oidc-token': 'eyJhbGciOi-fake',
        'x-vercel-sc-headers': '{"authorization":"Bearer x"}',
        'x-forwarded-for': '198.51.100.20',
        'x-api-key': 'should-not-be-stored',
      },
      body: JSON.stringify({
        event_type: 'crawl',
        agent_name: 'Header-Sanitize-Tester',
        source_endpoint: '/llms.txt',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    const events = await getRecentEvents(20);
    const storedEvent = events.find((e) => e.id === json.event_id);
    expect(storedEvent).toBeDefined();
    const headers = storedEvent?.headers || {};
    const names = Object.keys(headers).map((k) => k.toLowerCase());
    expect(names).toContain('user-agent');
    expect(names).toContain('accept');
    expect(names).toContain('x-forwarded-for');
    expect(names).not.toContain('authorization');
    expect(names).not.toContain('cookie');
    expect(names).not.toContain('x-vercel-oidc-token');
    expect(names).not.toContain('x-vercel-sc-headers');
    expect(names).not.toContain('x-api-key');
    expect(names.some((n) => n.startsWith('x-vercel-'))).toBe(false);
  });
});

  it('rejects unknown event types with 400 instead of attempting an insert', async () => {
    const req = new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer agy_agent_test_key_valid_2026',
      },
      body: JSON.stringify({
        event_type: 'not_a_real_type',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid event_type');
  });
