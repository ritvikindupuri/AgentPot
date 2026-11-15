import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HoneypotEvent, Session, EventType, EventSeverity } from '../types';
import {
  calculateEventSeverity,
  fallbackSessionId,
  getOrCreateSessionId,
  isGenericFamily,
  isTestRequest,
  preferAgentFamily,
  scoreEvents,
  SESSION_RELINK_WINDOW_MS,
  sessionIdFromHeaders,
} from '../session';
import { sanitizeHeaders } from '../headers';
import { CANARY_LIBRARY, PLANTED_CREDENTIALS } from '../canaries';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-service-key';

let cachedServerClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  if (!cachedServerClient) {
    cachedServerClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  return cachedServerClient;
}

// In-memory runtime buffer for sessions and events when Supabase DB is unconfigured
// Strictly stores REAL incoming requests only. NO mock or seed data.
const runtimeSessions = new Map<string, Session>();
const runtimeEvents: HoneypotEvent[] = [];

export interface RecordEventParams {
  sessionId: string;
  eventType: EventType;
  canaryId?: string | null;
  agentFamily: string;
  sourceEndpoint: string;
  requestMethod: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  headers?: Record<string, any>;
  payload?: Record<string, any>;
  clientInfo?: Record<string, any>;
  toolName?: string;
  isTest?: boolean;
}

// Free-tier guard: cap stored raw headers/payload at a few KB (mirrored by a DB trigger).
export function capJson(
  obj: Record<string, any> | undefined,
  maxBytes: number
): Record<string, any> {
  if (!obj) return {};
  let text: string;
  try {
    text = JSON.stringify(obj);
  } catch {
    return { _truncated: true, preview: '[unserializable]' };
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return obj;
  return { _truncated: true, _original_bytes: bytes, preview: text.slice(0, maxBytes - 200) };
}


export function credentialUseLabel(event: {
  canary_id?: string | null;
  payload?: Record<string, any> | null;
}): string {
  const canaryId = event.canary_id || (event.payload?.canary_id as string) || '';
  if (canaryId) {
    const planted = PLANTED_CREDENTIALS.find(
      (item) => item.canary_id === canaryId || item.key_id === canaryId
    );
    if (planted) return planted.key_name || planted.key_id;
    const canary = CANARY_LIBRARY.find((item) => item.id === canaryId);
    if (canary) return canary.name || canary.id;
    return canaryId;
  }
  const payload = event.payload || {};
  const fromPayload =
    (payload.credential_name as string) ||
    (payload.credentialName as string) ||
    (payload.matched_credential as string) ||
    (payload.credentialKey as string) ||
    (payload.key_id as string) ||
    (payload.key as string);
  return fromPayload || 'unknown';
}

async function findRecentSessionIdByUserAgent(
  userAgent: string,
  isTest: boolean
): Promise<string | null> {
  const ua = (userAgent || '').slice(0, 512);
  if (!ua) return null;
  const since = new Date(Date.now() - SESSION_RELINK_WINDOW_MS).toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      let query = supabase
        .from('sessions')
        .select('id, last_seen')
        .eq('user_agent', ua)
        .gte('last_seen', since)
        .order('last_seen', { ascending: false })
        .limit(1);
      query = isTest ? query.eq('is_test', true) : query.or('is_test.eq.false,is_test.is.null');
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data[0].id as string;
      }
    } catch (err) {
      console.error('session relink lookup failed', err);
    }
  }

  let best: Session | null = null;
  const sinceMs = Date.now() - SESSION_RELINK_WINDOW_MS;
  for (const session of runtimeSessions.values()) {
    if ((session.user_agent || '') !== ua) continue;
    const sessionIsTest = Boolean((session as Session & { is_test?: boolean }).is_test);
    if (sessionIsTest !== isTest) continue;
    const last = new Date(session.last_seen).getTime();
    if (Number.isNaN(last) || last < sinceMs) continue;
    if (!best || new Date(session.last_seen).getTime() > new Date(best.last_seen).getTime()) {
      best = session;
    }
  }
  return best?.id || null;
}

export async function resolveSessionId(
  headers: Record<string, string>,
  ip: string,
  userAgent: string,
  options?: { isTest?: boolean }
): Promise<string> {
  const isTest = options?.isTest ?? isTestRequest(headers);
  const hinted = getOrCreateSessionId(headers, ip, userAgent, { isTest });
  if (sessionIdFromHeaders(headers)) return hinted;
  const found = await findRecentSessionIdByUserAgent(userAgent, isTest);
  if (found) return found;
  return fallbackSessionId(userAgent, { isTest });
}

function toolNameFrom(params: RecordEventParams): string | undefined {
  return (
    params.toolName ||
    (typeof params.payload?.tool === 'string' ? params.payload.tool : undefined) ||
    (typeof params.payload?.toolName === 'string' ? params.payload.toolName : undefined)
  );
}

function unfinishedEvent(
  eventId: string,
  params: RecordEventParams,
  severity: EventSeverity,
  now: string
): HoneypotEvent {
  return {
    id: eventId,
    session_id: params.sessionId,
    event_type: params.eventType,
    canary_id: params.canaryId || null,
    agent_family: params.agentFamily,
    source_endpoint: params.sourceEndpoint,
    request_method: params.requestMethod,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    headers: params.headers || {},
    payload: params.payload || {},
    severity,
    created_at: now,
    persisted: false,
  };
}

export async function recordHoneypotEvent(
  params: RecordEventParams
): Promise<HoneypotEvent> {
  const isTest =
    params.isTest ??
    isTestRequest(params.headers, params.payload as Record<string, unknown> | undefined);

  params = {
    ...params,
    headers: capJson(sanitizeHeaders(params.headers), 4096),
    payload: capJson(params.payload, 8192),
    clientInfo: capJson(params.clientInfo, 2048),
    userAgent: params.userAgent ? params.userAgent.slice(0, 512) : params.userAgent,
    isTest,
  };

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  const supabase = getSupabaseAdmin();

  let existingSession: (Session & { is_test?: boolean }) | null = null;
  let priorEvents: HoneypotEvent[] = [];

  if (supabase) {
    try {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.sessionId)
        .maybeSingle();
      existingSession = (data as Session) || null;
    } catch (err) {
      console.error('session lookup failed', err);
    }
  } else {
    existingSession = runtimeSessions.get(params.sessionId) || null;
  }

  if (supabase && existingSession) {
    try {
      const { data } = await supabase
        .from('events')
        .select('event_type, payload, agent_family')
        .eq('session_id', params.sessionId)
        .order('created_at', { ascending: true });
      priorEvents = (data as HoneypotEvent[]) || [];
    } catch (err) {
      console.error('prior events lookup failed', err);
    }
  } else if (!supabase) {
    priorEvents = runtimeEvents
      .filter((event) => event.session_id === params.sessionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const sessionHasInjection = priorEvents.some((event) => event.event_type === 'injection_fired');
  const resolvedFamily = preferAgentFamily(existingSession?.agent_family, params.agentFamily);
  params = { ...params, agentFamily: resolvedFamily };

  const { severity } = calculateEventSeverity(params.eventType, {
    toolName: toolNameFrom(params),
    canaryId: params.canaryId || undefined,
    isCredential: params.eventType === 'credential_use',
    isExfil: params.eventType === 'exfil_attempt',
    sessionHasInjection,
  });

  const eventRow = {
    id: eventId,
    session_id: params.sessionId,
    event_type: params.eventType,
    canary_id: params.canaryId || null,
    agent_family: resolvedFamily,
    source_endpoint: params.sourceEndpoint,
    request_method: params.requestMethod,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    headers: params.headers || {},
    payload: params.payload || {},
    severity,
    created_at: now,
    is_test: isTest,
  };

  const persistSessionCounts = async (allEvents: HoneypotEvent[]) => {
    const eventCount = allEvents.length;
    const severityScore = scoreEvents(allEvents);
    let family = resolvedFamily;
    for (const event of allEvents) {
      family = preferAgentFamily(family, event.agent_family);
    }
    return { eventCount, severityScore, family };
  };

  if (supabase) {
    try {
      if (!existingSession) {
        const { error: sessionInsertError } = await supabase.from('sessions').insert({
          id: params.sessionId,
          ip_address: params.ipAddress || null,
          user_agent: params.userAgent || null,
          agent_family: resolvedFamily,
          client_info: params.clientInfo || {},
          severity_score: 0,
          event_count: 0,
          first_seen: now,
          last_seen: now,
          is_test: isTest,
        });

        if (sessionInsertError) {
          // Concurrent insert: load the winner and continue. Any other error is fatal.
          const { data: raced } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', params.sessionId)
            .maybeSingle();
          if (!raced) {
            console.error('sessions insert failed', sessionInsertError.code, sessionInsertError.message);
            return unfinishedEvent(eventId, params, severity, now);
          }
          existingSession = raced as Session;
        }
      }

      const { data: newEvent, error } = await supabase
        .from('events')
        .insert(eventRow)
        .select()
        .single();

      if (error) {
        console.error('events insert failed', error.code, error.message, 'event_type=', params.eventType);
        return unfinishedEvent(eventId, params, severity, now);
      }

      const { data: allRows } = await supabase
        .from('events')
        .select('event_type, payload, agent_family')
        .eq('session_id', params.sessionId)
        .order('created_at', { ascending: true });
      const allEvents = (allRows as HoneypotEvent[]) || [...priorEvents, { ...(newEvent as HoneypotEvent) }];
      const { eventCount, severityScore, family } = await persistSessionCounts(allEvents);

      const { error: sessionUpdateError } = await supabase
        .from('sessions')
        .update({
          severity_score: severityScore,
          event_count: eventCount,
          last_seen: now,
          agent_family: family,
        })
        .eq('id', params.sessionId);

      if (sessionUpdateError) {
        console.error('sessions update failed', sessionUpdateError.code, sessionUpdateError.message);
      }

      if (family !== resolvedFamily || priorEvents.some((event) => event.agent_family !== family)) {
        const { error: backfillError } = await supabase
          .from('events')
          .update({ agent_family: family })
          .eq('session_id', params.sessionId)
          .neq('agent_family', family);
        if (backfillError) {
          console.error('event family backfill failed', backfillError.code, backfillError.message);
        }
      }

      return { ...(newEvent as HoneypotEvent), agent_family: family, persisted: true };
    } catch (err: any) {
      console.error('events insert failed', err?.code || 'EXCEPTION', err?.message || String(err));
      return unfinishedEvent(eventId, params, severity, now);
    }
  }

  // Runtime in-memory store (real requests only, plus flagged test events)
  let session = runtimeSessions.get(params.sessionId);
  if (!session) {
    session = {
      id: params.sessionId,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      agent_family: resolvedFamily,
      client_info: params.clientInfo || {},
      severity_score: 0,
      event_count: 0,
      first_seen: now,
      last_seen: now,
      is_test: isTest,
    };
    runtimeSessions.set(params.sessionId, session);
  }

  const memoryEvent: HoneypotEvent = {
    ...eventRow,
    persisted: true,
  };

  runtimeEvents.unshift(memoryEvent);
  if (runtimeEvents.length > 500) runtimeEvents.pop();

  const allEvents = runtimeEvents
    .filter((event) => event.session_id === params.sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const { eventCount, severityScore, family } = await persistSessionCounts(allEvents);
  session.event_count = eventCount;
  session.severity_score = severityScore;
  session.last_seen = now;
  session.agent_family = family;
  if (isGenericFamily(session.agent_family) && !isGenericFamily(resolvedFamily)) {
    session.agent_family = resolvedFamily;
  }
  for (const event of allEvents) {
    event.agent_family = session.agent_family;
  }

  return { ...memoryEvent, agent_family: session.agent_family };
}

export async function getRecentEvents(limit = 100): Promise<HoneypotEvent[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or('is_test.eq.false,is_test.is.null')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as HoneypotEvent[];
      }
    } catch (e) {
      console.error('Error fetching recent events from Supabase:', e);
    }
  }
  return runtimeEvents.filter((event) => !event.is_test).slice(0, limit);
}

export async function getSessions(limit = 50): Promise<Session[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .or('is_test.eq.false,is_test.is.null')
        .order('last_seen', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as Session[];
      }
    } catch (e) {
      console.error('Error fetching sessions from Supabase:', e);
    }
  }
  return Array.from(runtimeSessions.values())
    .filter((session) => !session.is_test)
    .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
    .slice(0, limit);
}

export async function getSessionDetails(
  sessionId: string
): Promise<{ session: Session | null; events: HoneypotEvent[] }> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (session) {
        return {
          session: session as Session,
          events: (events as HoneypotEvent[]) || [],
        };
      }
    } catch (e) {
      console.error('Error fetching session details:', e);
    }
  }

  const session = runtimeSessions.get(sessionId) || null;
  const events = runtimeEvents
    .filter((e) => e.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return { session, events };
}

export async function getTelemetryStats() {
  const events = await getRecentEvents(500);
  const sessions = await getSessions(100);

  // Group by event type
  const eventTypeCounts: Record<string, number> = {
    crawl: 0,
    injection_fired: 0,
    tool_call: 0,
    credential_use: 0,
    exfil_attempt: 0,
    mcp_connect: 0,
    tool_discovery: 0,
  };

  // Group by agent family
  const agentFamilyCounts: Record<string, number> = {};

  // Tool calls breakdown
  const toolCallCounts: Record<string, number> = {};

  // Planted credentials use
  const credentialUses: Record<string, number> = {};

  // Canary attribution hits
  const canaryHits: Record<string, number> = {};

  // Timeline (hourly buckets for last 24h), with type and severity breakdowns
  const timelineBuckets: Record<string, {
    count: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }> = {};

  for (const event of events) {
    eventTypeCounts[event.event_type] = (eventTypeCounts[event.event_type] || 0) + 1;
    agentFamilyCounts[event.agent_family] = (agentFamilyCounts[event.agent_family] || 0) + 1;

    if (event.event_type === 'tool_call') {
      const tool = (event.payload?.tool as string) || 'unknown';
      toolCallCounts[tool] = (toolCallCounts[tool] || 0) + 1;
    }

    if (event.event_type === 'credential_use') {
      const cred = credentialUseLabel(event);
      credentialUses[cred] = (credentialUses[cred] || 0) + 1;
    }

    if (event.canary_id) {
      canaryHits[event.canary_id] = (canaryHits[event.canary_id] || 0) + 1;
    }

    const hour = event.created_at.slice(0, 13) + ':00';
    if (!timelineBuckets[hour]) {
      timelineBuckets[hour] = { count: 0, byType: {}, bySeverity: {} };
    }
    const bucket = timelineBuckets[hour];
    bucket.count += 1;
    bucket.byType[event.event_type] = (bucket.byType[event.event_type] || 0) + 1;
    const sev = event.severity || 'info';
    bucket.bySeverity[sev] = (bucket.bySeverity[sev] || 0) + 1;
  }

  // Canary stats
  const canaryStats = CANARY_LIBRARY.map((canary) => {
    const hits = canaryHits[canary.id] || 0;
    return {
      canary,
      hits,
    };
  });

  return {
    totalEvents: events.length,
    totalSessions: sessions.length,
    eventTypeCounts,
    agentFamilyCounts,
    toolCallCounts,
    credentialUses,
    canaryStats,
    timelineBuckets,
  };
}
