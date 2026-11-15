import { EventType } from './types';

/** Max gap between lure hits in one scan cluster. About two seconds, with slack for rotating egress. */
export const LURE_GAP_MS = 3000;
export const LINK_SCAN_MIN_DISTINCT = 3;
export const LINK_SCANNER_FAMILY = 'Link Scanner';

const LURE_PREFIXES = [
  '/c/',
  '/status/',
  '/v1/register/',
  '/assets/',
  '/releases/',
  '/advisories/',
  '/v1/crawl-token/',
  '/openapi/',
  '/reference/',
  '/moved/',
  '/v1/peers/',
];

export interface EventLite {
  id?: string;
  source_endpoint: string;
  created_at: string;
  event_type?: string;
  canary_id?: string | null;
  agent_family?: string | null;
}

export function normalizeLurePath(path: string): string {
  const raw = (path || '').split('?')[0].trim();
  return raw.replace(/\.(json|ya?ml|png|svg|html?)$/i, '');
}

export function isLureEndpoint(path: string): boolean {
  const p = normalizeLurePath(path);
  if (p === '/mcp') return true;
  return LURE_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export function isHealthCheckPath(path: string): boolean {
  return normalizeLurePath(path).startsWith('/status/');
}

export function credentialKeyFromPayload(
  payload?: Record<string, unknown> | null
): string | null {
  if (!payload) return null;
  for (const key of ['matched_credential', 'presented_key', 'key_id'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function isRepeatCredentialUse(
  prior: Array<{ event_type?: string; payload?: Record<string, unknown> | null }>,
  payload?: Record<string, unknown> | null
): boolean {
  const key = credentialKeyFromPayload(payload);
  if (!key) return false;
  return prior.some(
    (event) => event.event_type === 'credential_use' && credentialKeyFromPayload(event.payload) === key
  );
}

export function linkScanClusters(events: EventLite[], gapMs = LURE_GAP_MS): EventLite[][] {
  const lureEvents = [...events]
    .filter((event) => isLureEndpoint(event.source_endpoint))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const groups: EventLite[][] = [];
  let current: EventLite[] = [];
  let lastT = 0;
  for (const event of lureEvents) {
    const t = new Date(event.created_at).getTime();
    if (!current.length || t - lastT <= gapMs) {
      current.push(event);
    } else {
      groups.push(current);
      current = [event];
    }
    lastT = t;
  }
  if (current.length) groups.push(current);

  return groups.filter((group) => {
    const keys = new Set(group.map((event) => normalizeLurePath(event.source_endpoint)));
    return keys.size >= LINK_SCAN_MIN_DISTINCT;
  });
}

export function eventInLinkScanCluster(events: EventLite[], target: EventLite): boolean {
  return linkScanClusters(events).some((cluster) =>
    cluster.some((event) => {
      if (target.id && event.id) return event.id === target.id;
      return (
        normalizeLurePath(event.source_endpoint) === normalizeLurePath(target.source_endpoint) &&
        event.created_at === target.created_at
      );
    })
  );
}

export function classifyLureHit(opts: {
  path: string;
  canaryId?: string | null;
  isExfil?: boolean;
  recent: EventLite[];
  at?: Date;
}): { eventType: EventType; familyOverride?: string } {
  if (opts.isExfil) {
    return { eventType: 'exfil_attempt' };
  }
  if (isHealthCheckPath(opts.path)) {
    return { eventType: 'lure_followed' };
  }

  const at = opts.at ?? new Date();
  const incoming: EventLite = {
    source_endpoint: opts.path,
    created_at: at.toISOString(),
  };
  const recent = [...opts.recent, incoming];
  if (eventInLinkScanCluster(recent, incoming)) {
    return { eventType: 'link_scan', familyOverride: LINK_SCANNER_FAMILY };
  }
  return { eventType: 'injection_fired' };
}
