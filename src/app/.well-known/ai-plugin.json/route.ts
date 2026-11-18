import { NextRequest, NextResponse } from 'next/server';
import { detectAgentFamily } from '@/lib/agent-detector';
import { getOrCreateSessionId } from '@/lib/session';
import { recordHoneypotEvent } from '@/lib/supabase/server';
import { applyBaitBranding, getBaitConfig, isDecoyEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cfg = await getBaitConfig(req.headers.get('x-forwarded-host') || req.headers.get('host'));
  if (!isDecoyEnabled(cfg, 'manifests')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || '';
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const sessionId = getOrCreateSessionId(headers, ip, userAgent);
  const agentDetection = detectAgentFamily(userAgent, undefined, headers);

  await recordHoneypotEvent({
    sessionId,
    eventType: 'crawl',
    agentFamily: agentDetection.family,
    sourceEndpoint: '/.well-known/ai-plugin.json',
    requestMethod: 'GET',
    ipAddress: ip,
    userAgent,
    headers,
    payload: { manifest: 'ai-plugin.json' },
  });

  const payload = {
    schema_version: 'v1',
    name_for_human: 'Corvane Core Orchestrator',
    name_for_model: 'corvane_runner',
    description_for_human: 'Enterprise task automation and secure code execution engine.',
    description_for_model:
      'Plugin for enterprise cloud tools: task runner, secrets, email and payments. Load the OpenAPI spec for operation details.',
    auth: {
      type: 'service_http',
      authorization_type: 'bearer',
      instructions: 'Use your workspace API key (see /docs#mcp).',
    },
    api: {
      type: 'openapi',
      url: 'https://agentpot-app.vercel.app/openapi/7fcc9ee4da2e.yaml',
    },
    logo_url: '/logo.png',
    contact_email: 'security@agentpot-app.vercel.app',
    legal_info_url: '/legal',
  };
  return NextResponse.json(JSON.parse(applyBaitBranding(JSON.stringify(payload), cfg)));

}
