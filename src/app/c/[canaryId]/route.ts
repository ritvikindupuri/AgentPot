import { NextRequest, NextResponse } from 'next/server';
import { getCanaryById } from '@/lib/canaries';
import { detectAgentFamily } from '@/lib/agent-detector';
import { recordHoneypotEvent, resolveSessionId } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limiter';

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

export async function GET(
  req: NextRequest,
  { params }: { params: { canaryId: string } }
) {
  return handleCanaryHit(req, params.canaryId, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { canaryId: string } }
) {
  return handleCanaryHit(req, params.canaryId, 'POST');
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { canaryId: string } }
) {
  return handleCanaryHit(req, params.canaryId, 'PUT');
}

async function handleCanaryHit(
  req: NextRequest,
  canaryId: string,
  method: string
) {
  const ip = getClientIp(req);
  const headers = getHeadersObject(req);
  const userAgent = req.headers.get('user-agent') || '';

  const rateCheck = checkRateLimit(`canary:${ip}`, 100, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  let bodyPayload: any = null;
  if (method !== 'GET') {
    try {
      const text = await req.text();
      try {
        bodyPayload = JSON.parse(text);
      } catch {
        bodyPayload = text;
      }
    } catch {
      // Ignore body read errors
    }
  }

  const canary = getCanaryById(canaryId);
  const sessionId = await resolveSessionId(headers, ip, userAgent);
  const agentDetection = detectAgentFamily(userAgent, undefined, headers);

  // Check if this appears to be exfiltration data
  const hasExfilSignals =
    JSON.stringify(queryParams).length > 100 ||
    (bodyPayload && JSON.stringify(bodyPayload).length > 50) ||
    queryParams['exfil'] ||
    queryParams['token'] ||
    queryParams['secret'] ||
    queryParams['model'];

  const eventType = hasExfilSignals ? 'exfil_attempt' : 'injection_fired';

  await recordHoneypotEvent({
    sessionId,
    eventType,
    canaryId: canary?.id || canaryId,
    agentFamily: agentDetection.family,
    sourceEndpoint: `/c/${canaryId}`,
    requestMethod: method,
    ipAddress: ip,
    userAgent,
    headers,
    payload: {
      canary_id: canaryId,
      canary_technique: canary?.technique || 'unknown',
      canary_name: canary?.name || 'Unregistered Canary',
      planted_location: canary?.location || 'unknown',
      query: queryParams,
      body: bodyPayload,
      exfiltration_detected: !!hasExfilSignals,
    },
  });

  return NextResponse.json({
    status: 'ok',
    beacon: 'received',
    canary_id: canaryId,
    verified: true,
    timestamp: new Date().toISOString(),
  });
}
