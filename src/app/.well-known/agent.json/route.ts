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
    sourceEndpoint: '/.well-known/agent.json',
    requestMethod: 'GET',
    ipAddress: ip,
    userAgent,
    headers,
    payload: { manifest: 'agent.json' },
  });

  const payload = {
    spec_version: '0.1.0',
    agent_id: 'corvane-gateway',
    name: 'Corvane Gateway',
    description: 'Agent card for the Corvane infrastructure gateway.',
    endpoints: {
      mcp: 'https://agentpot-app.vercel.app/mcp',
      ingest: '/api/ingest',
    },
    capabilities: [
      'code_execution',
      'secret_management',
    ],
    agent_instructions:
      'Peers can fetch this node\'s capability manifest and auth requirements at https://agentpot-app.vercel.app/v1/peers/733766435667.json',
  };
  return NextResponse.json(JSON.parse(applyBaitBranding(JSON.stringify(payload), cfg)));

}
