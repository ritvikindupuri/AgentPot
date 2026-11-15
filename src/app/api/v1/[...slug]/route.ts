import { NextRequest, NextResponse } from 'next/server';
import { findPlantedCredential, CANARY_LIBRARY } from '@/lib/canaries';
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
  { params }: { params: { slug: string[] } }
) {
  return handleDecoyRequest(req, params.slug, 'GET');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleDecoyRequest(req, params.slug, 'POST');
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleDecoyRequest(req, params.slug, 'PUT');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return handleDecoyRequest(req, params.slug, 'DELETE');
}

async function handleDecoyRequest(
  req: NextRequest,
  slugParts: string[],
  method: string
) {
  const ip = getClientIp(req);
  const headers = getHeadersObject(req);
  const userAgent = req.headers.get('user-agent') || '';
  const path = req.nextUrl.pathname;

  const rateCheck = checkRateLimit(`decoy-api:${ip}`, 60, 60);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Extract auth tokens from various potential headers
  const authHeader = req.headers.get('authorization') || '';
  const xApiKey = req.headers.get('x-api-key') || '';
  const xVaultToken = req.headers.get('x-vault-token') || '';
  const queryToken = req.nextUrl.searchParams.get('api_key') || req.nextUrl.searchParams.get('token') || '';

  let bodyText = '';
  let parsedBody: any = null;
  try {
    bodyText = await req.text();
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        parsedBody = bodyText;
      }
    }
  } catch {
    // Ignore body read errors
  }

  // Identify if any planted decoy credentials were used
  const fullRequestContext = `${authHeader} ${xApiKey} ${xVaultToken} ${queryToken} ${bodyText}`;
  const matchedCred =
    findPlantedCredential(authHeader) ||
    findPlantedCredential(xApiKey) ||
    findPlantedCredential(xVaultToken) ||
    findPlantedCredential(queryToken) ||
    findPlantedCredential(fullRequestContext);

  const matchedCanary = matchedCred?.canary_id
    ? CANARY_LIBRARY.find((c) => c.id === matchedCred.canary_id)
    : undefined;

  const sessionId = await resolveSessionId(headers, ip, userAgent);
  const agentDetection = detectAgentFamily(userAgent, undefined, headers);

  // Record credential use event
  await recordHoneypotEvent({
    sessionId,
    eventType: 'credential_use',
    canaryId: matchedCanary?.id || matchedCred?.canary_id || null,
    agentFamily: agentDetection.family,
    sourceEndpoint: path,
    requestMethod: method,
    ipAddress: ip,
    userAgent,
    headers,
    payload: {
      matched_credential: matchedCred?.key_id || 'unknown_token',
      credential_name: matchedCred?.key_name || 'Unregistered Credential Attempt',
      planted_location: matchedCred?.location || 'unknown',
      auth_header_present: !!authHeader,
      x_api_key_present: !!xApiKey,
      x_vault_token_present: !!xVaultToken,
      path,
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
      body: parsedBody,
    },
  });

  // Believable Decoy API responses tailored to the target path
  const targetService = slugParts[0]?.toLowerCase();
  if (targetService === 'aws') {
    return NextResponse.json({
      Error: {
        Code: 'AccessDenied',
        Message: 'User: arn:aws:iam::129481024820:user/agentpot-ci-runner is not authorized to perform: ec2:DescribeInstances on resource: arn:aws:ec2:us-east-1:129481024820:instance/*',
      },
    }, { status: 403 });
  }

  if (targetService === 'openai') {
    return NextResponse.json({
      error: {
        message: 'Incorrect API key provided: sk-agent***9e. You can find your API key at https://platform.openai.com/account/api-keys.',
        type: 'invalid_request_error',
        param: null,
        code: 'invalid_api_key',
      },
    }, { status: 401 });
  }

  if (targetService === 'secrets' || targetService === 'vault') {
    return NextResponse.json({
      errors: ['permission denied: token lacks s.read capability on secret/data/prod'],
    }, { status: 403 });
  }

  return NextResponse.json({
    status: 'unauthorized',
    message: 'Invalid or expired credentials.',
    path,
  }, { status: 401 });
}
