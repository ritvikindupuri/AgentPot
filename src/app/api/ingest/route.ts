import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, recordHoneypotEvent, resolveSessionId } from '@/lib/supabase/server';
import { isTestRequest, normalizeEventType } from '@/lib/session';
import { EVENT_TYPES } from '@/lib/event-copy';
import { checkRateLimit, checkPayloadSize } from '@/lib/rate-limiter';
import { IngestPayload } from '@/lib/types';
import { CANARY_LIBRARY, PLANTED_CREDENTIALS } from '@/lib/canaries';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function getHeadersObject(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    h[key.toLowerCase()] = val;
  });
  return h;
}

// Known valid test keys for local verification / development
const KNOWN_AGENT_KEYS = new Set([
  'agy_agent_test_key_valid_2026',
  'test-agent-key-redteam-01',
]);

async function validateAgentApiKey(rawKey: string): Promise<{ valid: boolean; agentName?: string }> {
  if (!rawKey) return { valid: false };

  // Check env override
  if (process.env.AGENT_INGEST_KEY && rawKey === process.env.AGENT_INGEST_KEY) {
    return { valid: true, agentName: 'Master-Ingest-Agent' };
  }

  // Check known memory set for tests
  if (process.env.NODE_ENV === 'test' && KNOWN_AGENT_KEYS.has(rawKey)) {
    return { valid: true, agentName: `TestAgent-${rawKey.slice(0, 8)}` };
  }

  // Check Supabase agent_api_keys table
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
      const { data } = await supabase
        .from('agent_api_keys')
        .select('*')
        .or(`key_hash.eq.${hash},key_hash.eq.${rawKey}`)
        .eq('revoked', false)
        .single();

      if (data) {
        return { valid: true, agentName: data.agent_name };
      }
    } catch {
      // Ignore DB query errors
    }
  }

  return { valid: false };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const headers = getHeadersObject(req);
  const userAgent = req.headers.get('user-agent') || 'FriendlyTestAgent';

  // 1. Rate limiting
  const rateCheck = checkRateLimit(`ingest:${ip}`, 300, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // 2. Authentication check
  const authHeader = req.headers.get('authorization') || '';
  const xAgentKey = req.headers.get('x-agent-key') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  const apiKey = xAgentKey || bearerToken;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing API key. Provide Authorization: Bearer <key> or X-Agent-Key header.' },
      { status: 401 }
    );
  }

  const { valid, agentName } = await validateAgentApiKey(apiKey);
  if (!valid) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid agent API key' },
      { status: 401 }
    );
  }

  // 3. Read body with size check
  let rawBody = '';
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  const sizeCheck = checkPayloadSize(rawBody, 128 * 1024);
  if (!sizeCheck.valid) {
    return NextResponse.json({ error: sizeCheck.error }, { status: 413 });
  }

  let body: IngestPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventType = body.event_type
    ? normalizeEventType(body.event_type)
    : 'injection_fired';
  if (!eventType) {
    return NextResponse.json(
      {
        error: `Invalid event_type. Allowed: ${EVENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const isTest = isTestRequest(headers, {
    ...(body as unknown as Record<string, unknown>),
    ...((body.payload || {}) as Record<string, unknown>),
  });
  const sessionId = await resolveSessionId(headers, ip, userAgent, { isTest });
  const resolvedAgentName = body.agent_name || agentName || 'Friendly-Agent';

  let validCanaryId: string | null = null;
  let reportedCanaryId: string | undefined = undefined;

  if (body.canary_id) {
    const isKnown =
      CANARY_LIBRARY.some((c) => c.id === body.canary_id) ||
      PLANTED_CREDENTIALS.some((p) => p.canary_id === body.canary_id || p.key_id === body.canary_id);

    if (isKnown) {
      validCanaryId = body.canary_id;
    } else {
      reportedCanaryId = body.canary_id;
    }
  }

  const event = await recordHoneypotEvent({
    sessionId,
    eventType,
    canaryId: validCanaryId,
    agentFamily: `Self-Reported (${resolvedAgentName})`,
    sourceEndpoint: body.source_endpoint || '/api/ingest',
    requestMethod: 'POST',
    ipAddress: ip,
    userAgent,
    headers,
    payload: {
      ...body.payload,
      ...(reportedCanaryId ? { reported_canary_id: reportedCanaryId } : {}),
      self_reported: true,
      agent_name: resolvedAgentName,
      details: body.details,
    },
    isTest,
  });

  if (event.persisted === false) {
    return NextResponse.json({ error: 'Event not stored' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    event_id: event.id,
    session_id: sessionId,
    event_type: event.event_type,
    severity: event.severity,
  });
}
