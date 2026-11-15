import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HoneypotEvent, Session, EventType, EventSeverity } from '../types';
import { calculateEventSeverity, computeSessionSeverityScore } from '../session';
import { sanitizeHeaders } from '../headers';
import { CANARY_LIBRARY } from '../canaries';

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

export async function recordHoneypotEvent(
  params: RecordEventParams
): Promise<HoneypotEvent> {
  params = {
    ...params,
    headers: capJson(sanitizeHeaders(params.headers), 4096),
    payload: capJson(params.payload, 8192),
    clientInfo: capJson(params.clientInfo, 2048),
    userAgent: params.userAgent ? params.userAgent.slice(0, 512) : params.userAgent,
  };
  const { severity, scorePoints } = calculateEventSeverity(params.eventType, {
    toolName: params.toolName || (params.payload?.tool as string),
    canaryId: params.canaryId || undefined,
    isCredential: params.eventType === 'credential_use',
    isExfil: params.eventType === 'exfil_attempt',
  });

  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();

  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      // 1. Fetch or create session
      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', params.sessionId)
        .single();

      if (!existingSession) {
        const { error: sessionInsertError } = await supabase.from('sessions').insert({
          id: params.sessionId,
          ip_address: params.ipAddress || null,
          user_agent: params.userAgent || null,
          agent_family: params.agentFamily,
          client_info: params.clientInfo || {},
          severity_score: scorePoints,
          event_count: 1,
          first_seen: now,
          last_seen: now,
        });

        if (sessionInsertError) {
          console.error('sessions insert failed', sessionInsertError.code, sessionInsertError.message);
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
      } else {
        const newScore = computeSessionSeverityScore(
          existingSession.severity_score || 0,
          scorePoints
        );
        const { error: sessionUpdateError } = await supabase
          .from('sessions')
          .update({
            severity_score: newScore,
            event_count: (existingSession.event_count || 1) + 1,
            last_seen: now,
            agent_family:
              existingSession.agent_family === 'Unknown' ||
              existingSession.agent_family === 'Generic / Unknown Agent'
                ? params.agentFamily
                : existingSession.agent_family,
          })
          .eq('id', params.sessionId);

        if (sessionUpdateError) {
          console.error('sessions update failed', sessionUpdateError.code, sessionUpdateError.message);
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
      }

      // 2. Insert event
      const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
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
        })
        .select()
        .single();

      if (error) {
        console.error('events insert failed', error.code, error.message);
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

      if (newEvent) {
        return { ...(newEvent as HoneypotEvent), persisted: true };
      }
    } catch (err: any) {
      console.error('events insert failed', err?.code || 'EXCEPTION', err?.message || String(err));
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
  }

  // Runtime in-memory store (real requests only)
  let session = runtimeSessions.get(params.sessionId);
  if (!session) {
    session = {
      id: params.sessionId,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      agent_family: params.agentFamily,
      client_info: params.clientInfo || {},
      severity_score: scorePoints,
      event_count: 1,
      first_seen: now,
      last_seen: now,
    };
    runtimeSessions.set(params.sessionId, session);
  } else {
    session.event_count += 1;
    session.severity_score = computeSessionSeverityScore(
      session.severity_score,
      scorePoints
    );
    session.last_seen = now;
    if (
      session.agent_family === 'Unknown' ||
      session.agent_family === 'Generic / Unknown Agent'
    ) {
      session.agent_family = params.agentFamily;
    }
  }

  const memoryEvent: HoneypotEvent = {
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
    persisted: true,
  };

  runtimeEvents.unshift(memoryEvent);
  if (runtimeEvents.length > 500) runtimeEvents.pop();

  return memoryEvent;
}

export async function getRecentEvents(limit = 100): Promise<HoneypotEvent[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data as HoneypotEvent[];
      }
    } catch (e) {
      console.error('Error fetching recent events from Supabase:', e);
    }
  }
  return runtimeEvents.slice(0, limit);
}

export async function getSessions(limit = 50): Promise<Session[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
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
      const cred = (event.payload?.credentialKey as string) || (event.payload?.key as string) || 'unknown';
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
