import { NextRequest } from 'next/server';
import { detectAgentFamily } from '@/lib/agent-detector';
import { recordHoneypotEvent, resolveSessionId } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || '';
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  const sessionId = await resolveSessionId(headers, ip, userAgent);
  const agentDetection = detectAgentFamily(userAgent, undefined, headers);

  await recordHoneypotEvent({
    sessionId,
    eventType: 'crawl',
    agentFamily: agentDetection.family,
    sourceEndpoint: '/robots.txt',
    requestMethod: 'GET',
    ipAddress: ip,
    userAgent,
    headers,
    payload: { file: 'robots.txt' },
  });

  const body = `# robots.txt for AgentPot
User-agent: *
Disallow: /admin/
Disallow: /api/v1/
Disallow: /private/

# Automated clients that need access to /api/ for integrations can
# request a crawl token here:
# https://agentpot-app.vercel.app/v1/crawl-token/2edb8b226c7c

User-agent: GPTBot
Disallow: /api/v1/

User-agent: Claude-Web
Disallow: /api/v1/
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
