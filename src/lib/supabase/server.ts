import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HoneypotEvent, Session, EventType, EventSeverity } from '../types';
import {
  calculateEventSeverity,
  ensureTestSessionId,
  fallbackSessionId,
  getOrCreateSessionId,
  isGenericFamily,
  isTestRequest,
  preferAgentFamily,
  scoreEvents,
  SESSION_RELINK_WINDOW_MS,
  sessionIdFromHeaders,
  sessionLockKey,
  testRunId,
  withSessionLock,
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
  isTest: boolean,
  at: Date = new Date()
): Promise<string | null> {
  const ua = (userAgent || '').slice(0, 512);
  if (!ua) return null;
  const since = new Date(at.getTime() - SESSION_RELINK_WINDOW_MS).toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      let query = supabase
        .from('sessions')
        .select('id, last_seen, session_key')
        .eq('user_agent', ua)
        .gte('last_seen', since)
        .or('session_key.is.null,session_key.not.like.test:run:%')
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
  const sinceMs = at.getTime() - SESSION_RELINK_WINDOW_MS;
  for (const session of runtimeSessions.values()) {
    if ((session.user_agent || '') !== ua) continue;
    const sessionIsTest = Boolean((session as Session & { is_test?: boolean }).is_test);
    if (sessionIsTest !== isTest) continue;
    if ((session.session_key || '').startsWith('test:run:')) continue;
    const last = new Date(session.last_seen).getTime();
    if (Number.isNaN(last) || last < sinceMs) continue;
    if (!best || new Date(session.last_seen).getTime() > new Date(best.last_seen).getTime()) {
      best = session;
    }
  }
  return best?.id || null;
}

async function resolveSessionIdLocked(
  headers: Record<string, string>,
  ip: string,
  userAgent: string,
  isTest: boolean,
  runId: string | null,
  at: Date
): Promise<string> {
  const hinted = sessionIdFromHeaders(headers);
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('resolve_agent_session', {
        p_hinted_id: hinted,
        p_user_agent: (userAgent || '').slice(0, 512),
        p_is_test: isTest,
        p_run_id: runId,
        p_ip: ip || null,
        p_now: at.toISOString(),
        p_window_seconds: Math.floor(SESSION_RELINK_WINDOW_MS / 1000),
      });
      if (!error && typeof data === 'string' && data) {
        return data;
      }
      if (error) {
        console.error('resolve_agent_session rpc failed', error.code, error.message);
      }
    } catch (err) {
      console.error('resolve_agent_session rpc failed', err);
    }
  }

  if (hinted) {
    const id = getOrCreateSessionId(headers, ip, userAgent, { isTest, at, runId });
    touchRuntimeSession(id, userAgent, isTest, at, ip);
    return id;
  }
  if (isTest && runId) {
    const id = fallbackSessionId(userAgent, { isTest, runId, at });
    touchRuntimeSession(id, userAgent, isTest, at, ip, `test:run:${runId}`);
    return id;
  }
  const found = await findRecentSessionIdByUserAgent(userAgent, isTest, at);
  if (found) {
    touchRuntimeSession(found, userAgent, isTest, at, ip);
    return found;
  }
  const created = fallbackSessionId(userAgent, { isTest, at });
  touchRuntimeSession(created, userAgent, isTest, at, ip);
  return created;
}

function touchRuntimeSession(
  id: string,
  userAgent: string,
  isTest: boolean,
  at: Date,
  ip?: string,
  sessionKey?: string | null
): void {
  const now = at.toISOString();
  const existing = runtimeSessions.get(id);
  if (existing) {
    if (isTest) existing.is_test = true;
    if (!existing.user_agent && userAgent) existing.user_agent = userAgent.slice(0, 512);
    if (sessionKey && !existing.session_key) existing.session_key = sessionKey;
    return;
  }
  runtimeSessions.set(id, {
    id,
    ip_address: ip || null,
    user_agent: userAgent ? userAgent.slice(0, 512) : null,
    agent_family: 'Generic / Unknown Agent',
    client_info: {},
    severity_score: 0,
    event_count: 0,
    first_seen: now,
    last_seen: now,
    is_test: isTest,
    session_key: sessionKey || null,
  });
}

export async function resolveSessionId(
  headers: Record<string, string>,
  ip: string,
  userAgent: string,
  options?: { isTest?: boolean; at?: Date; runId?: string | null }
): Promise<string> {
  const isTest = options?.isTest ?? isTestRequest(headers, undefined);
  const runId = options?.runId ?? testRunId(headers);
  const at = options?.at ?? new Date();
  const lockKey = sessionLockKey({
    isTest,
    runId,
    userAgent: (userAgent || '').slice(0, 512),
    hintedId: sessionIdFromHeaders(headers),
  });
  return withSessionLock(lockKey, () =>
    resolveSessionIdLocked(headers, ip, userAgent, isTest, runId, at)
  );
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

  let sessionId = params.sessionId;

  params = {
    ...params,
    sessionId,
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

  if (isTest) {
    const existingIsTest = Boolean(existingSession?.is_test);
    if (existingSession && existingIsTest) {
      sessionId = existingSession.id;
    } else if (existingSession && !existingIsTest) {
      sessionId = ensureTestSessionId(params.sessionId, params.userAgent || '');
      existingSession = null;
      priorEvents = [];
    } else if (!sessionId.startsWith('sess_test_')) {
      sessionId = ensureTestSessionId(sessionId, params.userAgent || '');
    }
    if (sessionId !== params.sessionId) {
      params = { ...params, sessionId };
      if (supabase) {
        try {
          const { data } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();
          existingSession = (data as Session) || null;
        } catch (err) {
          console.error('session retarget lookup failed', err);
        }
      } else {
        existingSession = runtimeSessions.get(sessionId) || null;
      }
    }
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

      // event_count and severity_score are maintained by the events trigger
      // (refresh_session_stats) so concurrent inserts cannot clobber the count.
      const { error: sessionUpdateError } = await supabase
        .from('sessions')
        .update({
          last_seen: now,
          agent_family: family,
          is_test: Boolean(isTest || existingSession?.is_test),
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
  const memoryEvent: HoneypotEvent = {
    ...eventRow,
    persisted: true,
  };

  const memoryResult = await withSessionLock(`id:${params.sessionId}`, async () => {
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
    if (isTest) {
      session.is_test = true;
    }
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
    return { event: memoryEvent, family: session.agent_family };
  });
  return { ...memoryResult.event, agent_family: memoryResult.family, persisted: true };
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
