import { NextRequest, NextResponse } from 'next/server';
import { checkDashboardAuth } from '@/lib/auth';
import { getBaitConfig, saveCompanySettings, parseDecoysEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const cfg = await getBaitConfig();
  return NextResponse.json({
    org_id: cfg.orgId,
    company_name: cfg.companyName,
    decoy_hostname: cfg.decoyHostname,
    decoys_enabled: cfg.decoysEnabled,
    resolved_hostname: cfg.hostname,
    resolved_base_url: cfg.baseUrl,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await checkDashboardAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const saved = await saveCompanySettings({
    companyName: typeof body.company_name === 'string' ? body.company_name : undefined,
    decoyHostname: typeof body.decoy_hostname === 'string' ? body.decoy_hostname : undefined,
    decoysEnabled: body.decoys_enabled ? parseDecoysEnabled(body.decoys_enabled) : undefined,
  });
  const cfg = await getBaitConfig();
  return NextResponse.json({
    org_id: saved.orgId,
    company_name: saved.companyName,
    decoy_hostname: saved.decoyHostname,
    decoys_enabled: saved.decoysEnabled,
    resolved_hostname: cfg.hostname,
    resolved_base_url: cfg.baseUrl,
  });
}
