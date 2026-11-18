import { headers } from 'next/headers';

export const DEFAULT_ORG_ID = 'org_default';
export const DEFAULT_COMPANY_NAME = 'Corvane';
export const DEFAULT_DECOY_HOST = 'agentpot-app.vercel.app';

export type DecoyFlag = 'mcp' | 'docs' | 'llms.txt' | 'manifests';

export const DEFAULT_DECOYS: Record<DecoyFlag, boolean> = {
  mcp: true,
  docs: true,
  'llms.txt': true,
  manifests: true,
};

export interface CompanySettings {
  orgId: string;
  companyName: string;
  decoyHostname: string;
  decoysEnabled: Record<DecoyFlag, boolean>;
}

export interface BaitConfig extends CompanySettings {
  hostname: string;
  baseUrl: string;
}

export const defaultCompanySettings = (): CompanySettings => ({
  orgId: DEFAULT_ORG_ID,
  companyName: DEFAULT_COMPANY_NAME,
  decoyHostname: '',
  decoysEnabled: { ...DEFAULT_DECOYS },
});

export function normalizeHostname(raw: string): string {
  return (raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

export function hostnameAndBaseUrl(
  decoyHostname: string,
  requestHost?: string | null
): { hostname: string; baseUrl: string } {
  const hostname =
    normalizeHostname(decoyHostname) ||
    normalizeHostname(requestHost || '') ||
    normalizeHostname(process.env.NEXT_PUBLIC_APP_URL || '') ||
    DEFAULT_DECOY_HOST;
  const proto = hostname.startsWith('localhost') || hostname.startsWith('127.0.0.1') ? 'http' : 'https';
  return { hostname, baseUrl: `${proto}://${hostname}` };
}

export function parseDecoysEnabled(raw: unknown): Record<DecoyFlag, boolean> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_DECOYS };
  (Object.keys(DEFAULT_DECOYS) as DecoyFlag[]).forEach((key) => {
    if (typeof src[key] === 'boolean') out[key] = src[key];
  });
  return out;
}

function rowToSettings(row: Record<string, unknown> | null | undefined): CompanySettings {
  if (!row) return defaultCompanySettings();
  return {
    orgId: typeof row.org_id === 'string' && row.org_id.trim() ? row.org_id.trim() : DEFAULT_ORG_ID,
    companyName:
      typeof row.company_name === 'string' && row.company_name.trim()
        ? row.company_name.trim()
        : DEFAULT_COMPANY_NAME,
    decoyHostname: typeof row.decoy_hostname === 'string' ? row.decoy_hostname.trim() : '',
    decoysEnabled: parseDecoysEnabled(row.decoys_enabled),
  };
}

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const { getSupabaseAdmin } = await import('./supabase/server');
    const supabase = getSupabaseAdmin();
    if (!supabase) return defaultCompanySettings();
    const { data, error } = await supabase
      .from('company_settings')
      .select('org_id, company_name, decoy_hostname, decoys_enabled')
      .eq('id', 'default')
      .maybeSingle();
    if (error || !data) return defaultCompanySettings();
    return rowToSettings(data as Record<string, unknown>);
  } catch {
    return defaultCompanySettings();
  }
}

export async function saveCompanySettings(patch: Partial<CompanySettings>): Promise<CompanySettings> {
  const current = await getCompanySettings();
  const next: CompanySettings = {
    orgId: current.orgId,
    companyName: patch.companyName?.trim() || current.companyName,
    decoyHostname: patch.decoyHostname != null ? normalizeHostname(patch.decoyHostname) : current.decoyHostname,
    decoysEnabled: patch.decoysEnabled
      ? parseDecoysEnabled({ ...current.decoysEnabled, ...patch.decoysEnabled })
      : current.decoysEnabled,
  };
  const { getSupabaseAdmin } = await import('./supabase/server');
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from('company_settings').upsert({
      id: 'default',
      org_id: next.orgId,
      company_name: next.companyName,
      decoy_hostname: next.decoyHostname,
      decoys_enabled: next.decoysEnabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  return next;
}

export async function getBaitConfig(requestHost?: string | null): Promise<BaitConfig> {
  const settings = await getCompanySettings();
  let host = requestHost;
  if (!settings.decoyHostname && !host) {
    try {
      const h = headers();
      host = h.get('x-forwarded-host') || h.get('host');
    } catch {
      host = null;
    }
  }
  const { hostname, baseUrl } = hostnameAndBaseUrl(settings.decoyHostname, host);
  return { ...settings, hostname, baseUrl };
}

export function applyBaitBranding(text: string, cfg: BaitConfig): string {
  return text
    .replace(/https:\/\/agentpot-app\.vercel\.app/g, cfg.baseUrl)
    .replace(/agentpot-app\.vercel\.app/g, cfg.hostname)
    .replace(/Corvane/g, cfg.companyName);
}

export function isDecoyEnabled(cfg: Pick<CompanySettings, 'decoysEnabled'>, flag: DecoyFlag): boolean {
  return cfg.decoysEnabled[flag] !== false;
}
