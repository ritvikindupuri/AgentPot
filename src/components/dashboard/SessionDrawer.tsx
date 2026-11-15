'use client';

import React, { useEffect, useState } from 'react';
import { X, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Session, HoneypotEvent } from '@/lib/types';
import { SeverityPill, EventBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { useDashboardData } from './DashboardContext';
import { formatRelativeTime, formatShortTime } from '@/lib/format';

export function SessionDrawer() {
  const { selectedSessionId, closeSessionDrawer } = useDashboardData();
  const [data, setData] = useState<{ session: Session | null; events: HoneypotEvent[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedSessionId) {
      setData(null);
      return;
    }
    let isMounted = true;
    setLoading(true);

    fetch(`/api/sessions/${selectedSessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (isMounted && resData) setData(resData);
      })
      .catch((err) => console.error('Error fetching session details:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedSessionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSessionDrawer();
    };
    if (selectedSessionId) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSessionId, closeSessionDrawer]);

  if (!selectedSessionId) return null;

  const copySessionId = () => {
    navigator.clipboard.writeText(selectedSessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleEvent = (id: string) => setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleHeaders = (id: string) => setExpandedHeaders((prev) => ({ ...prev, [id]: !prev[id] }));

  const session = data?.session;
  const events = data?.events || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={closeSessionDrawer} aria-hidden="true" />
      <aside
        className="relative w-full sm:w-[480px] h-full bg-bg-subtle border-l border-border flex flex-col z-10 overflow-hidden drawer-transition"
        style={{ boxShadow: '0 0 0 1px #000, 0 24px 48px rgba(0,0,0,0.5)' }}
      >
        <div className="p-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text leading-5">
              {session?.agent_family || 'Session detail'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-xs text-text-faint">{selectedSessionId}</span>
              <button
                type="button"
                onClick={copySessionId}
                aria-label="Copy session ID"
                className="text-text-faint hover:text-text p-0.5 rounded transition-colors duration-120"
              >
                {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={closeSessionDrawer}
            aria-label="Close session details"
            className="text-text-muted hover:text-text p-1 -mr-1 rounded transition-colors duration-120"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-text-faint">Loading session…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 bg-surface border border-border rounded-lg text-xs">
                <div>
                  <div className="text-text-faint leading-4">IP</div>
                  <div className="font-mono text-[13px] text-text mt-0.5 truncate">{session?.ip_address || '127.0.0.1'}</div>
                </div>
                <div>
                  <div className="text-text-faint leading-4">Risk</div>
                  <div className="text-[13px] font-semibold text-text mt-0.5">{session?.severity_score ?? 0}</div>
                </div>
                <div>
                  <div className="text-text-faint leading-4">First seen</div>
                  <div className="text-[13px] text-text mt-0.5">{formatRelativeTime(session?.first_seen)}</div>
                </div>
                <div>
                  <div className="text-text-faint leading-4">Last seen</div>
                  <div className="text-[13px] text-text mt-0.5">{formatRelativeTime(session?.last_seen)}</div>
                </div>
                <div>
                  <div className="text-text-faint leading-4">Events</div>
                  <div className="text-[13px] text-text mt-0.5">{session?.event_count ?? events.length}</div>
                </div>
                <div>
                  <div className="text-text-faint leading-4">Status</div>
                  <div className="text-[13px] text-text mt-0.5">Recorded</div>
                </div>
                <div className="col-span-2 pt-1 border-t border-border">
                  <div className="text-text-faint leading-4">User agent</div>
                  <div className="font-mono text-[12px] text-text-muted mt-0.5 break-all">{session?.user_agent || 'Unknown UA'}</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text leading-5">Timeline</h3>
                {events.length === 0 ? (
                  <EmptyState title="No events in this session." />
                ) : (
                  <div className="relative pl-4 space-y-4 border-l border-border-strong ml-2">
                    {events.map((event) => {
                      const isExpanded = !!expandedEvents[event.id];
                      const areHeadersExpanded = !!expandedHeaders[event.id];
                      const sev = event.severity || 'info';
                      const dotColor =
                        sev === 'critical' ? '#FF6369' :
                        sev === 'high' ? '#FF9B52' :
                        sev === 'medium' ? '#F5C451' :
                        sev === 'low' ? '#6CB6FF' : '#6B7280';

                      return (
                        <div key={event.id} className="relative group text-xs">
                          <span
                            className="absolute -left-[21px] top-1.5 w-1.5 h-1.5 rounded-full ring-2 ring-bg-subtle"
                            style={{ backgroundColor: dotColor }}
                            aria-hidden="true"
                          />
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleEvent(event.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleEvent(event.id);
                              }
                            }}
                            className="cursor-pointer select-none space-y-1"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-text-faint font-mono text-[12px]">
                                {formatShortTime(event.created_at)}
                              </span>
                              <EventBadge type={event.event_type} />
                              <SeverityPill severity={event.severity} />
                              <span className="ml-auto text-text-faint group-hover:text-text transition-colors">
                                {isExpanded ? <ChevronDown size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}
                              </span>
                            </div>
                            <div className="font-mono text-[12px] text-text-muted truncate">
                              {event.source_endpoint}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              {event.canary_id && (
                                <div className="text-[12px]">
                                  <span className="text-text-faint">Canary: </span>
                                  <span className="font-mono text-accent-text">{event.canary_id}</span>
                                </div>
                              )}
                              <pre className="p-2.5 bg-bg border border-border rounded-md font-mono text-[12px] text-text-muted overflow-x-auto max-h-60">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                              {event.headers && Object.keys(event.headers).length > 0 && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleHeaders(event.id)}
                                    className="text-[12px] text-text-faint hover:text-text flex items-center gap-1"
                                  >
                                    <span>Headers</span>
                                    {areHeadersExpanded ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
                                  </button>
                                  {areHeadersExpanded && (
                                    <pre className="mt-1 p-2 bg-bg border border-border rounded-md font-mono text-[11px] text-text-faint overflow-x-auto max-h-40">
                                      {JSON.stringify(event.headers, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
