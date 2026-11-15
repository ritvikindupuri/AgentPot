'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDashboardData } from '@/components/dashboard/DashboardContext';
import { Tabs } from '@/components/ui/Tabs';
import { SeverityPill, EventBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import {
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { EVENT_TYPES, getEventTypeCopy } from '@/lib/event-copy';
import { Tooltip } from '@/components/ui/Tooltip';
import { formatFullTimestamp } from '@/lib/format';

const SEVERITY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
  { id: 'info', label: 'Info' },
];

const EVENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All events' },
  ...EVENT_TYPES.map((value) => ({ value, label: getEventTypeCopy(value).label })),
];

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toTimeString().slice(0, 8);
  } catch {
    return isoString;
  }
}

function EventsContent() {
  const searchParams = useSearchParams();
  const canaryQuery = searchParams.get('canary');

  const { events, openSessionDrawer, searchTerm, setSearchTerm } = useDashboardData();
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Canary query filter
      if (canaryQuery && e.canary_id !== canaryQuery) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && e.severity !== severityFilter) {
        return false;
      }

      // Event type filter
      if (eventTypeFilter !== 'all' && e.event_type !== eventTypeFilter) {
        return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesIp = e.ip_address?.toLowerCase().includes(term);
        const matchesAgent = e.agent_family.toLowerCase().includes(term);
        const matchesEndpoint = e.source_endpoint.toLowerCase().includes(term);
        const matchesCanary = e.canary_id?.toLowerCase().includes(term);
        if (!matchesIp && !matchesAgent && !matchesEndpoint && !matchesCanary) {
          return false;
        }
      }

      return true;
    }).slice(0, 150);
  }, [events, canaryQuery, severityFilter, eventTypeFilter, searchTerm]);

  const clearFilters = () => {
    setSeverityFilter('all');
    setEventTypeFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters =
    severityFilter !== 'all' || eventTypeFilter !== 'all' || !!searchTerm.trim() || !!canaryQuery;

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <Tabs
          tabs={SEVERITY_TABS}
          activeTab={severityFilter}
          onChange={setSeverityFilter}
          className="border-b-0"
        />

        <div className="flex items-center gap-2">
          {canaryQuery && (
            <span className="inline-flex items-center gap-1 text-xs text-text-faint bg-surface border border-border px-2 py-1 rounded">
              Canary: <span className="font-mono text-accent-text">{canaryQuery}</span>
            </span>
          )}

          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="h-8 bg-surface border border-border-strong rounded-md text-[13px] text-text px-2.5 transition-colors focus:outline-none cursor-pointer"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Table Container */}
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        {events.length === 0 ? (
          <EmptyState
            title="No events yet"
            sentence="Point an agent at your decoys to get started."
            action={
              <Link
                href="/docs"
                className="inline-flex items-center h-8 px-3 text-[13px] font-medium rounded-md bg-surface border border-border-strong text-text hover:bg-surface-hover transition-colors"
              >
                View decoy docs
              </Link>
            }
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No matching events"
            sentence="Try a different filter."
            action={
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <TableHead>
                  <TableHeaderCell className="w-20">Time</TableHeaderCell>
                  <TableHeaderCell className="w-28">Event</TableHeaderCell>
                  <TableHeaderCell className="w-24">Severity</TableHeaderCell>
                  <TableHeaderCell>Agent</TableHeaderCell>
                  <TableHeaderCell>Endpoint</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell w-28">IP</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell w-36">Canary</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      onClick={() => openSessionDrawer(event.session_id)}
                    >
                      <TableCell className="text-text-faint text-xs whitespace-nowrap">
                        <Tooltip content={formatFullTimestamp(event.created_at)}>
                          <time dateTime={event.created_at}>{formatTime(event.created_at)}</time>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <EventBadge type={event.event_type} />
                      </TableCell>
                      <TableCell>
                        <SeverityPill severity={event.severity} />
                      </TableCell>
                      <TableCell truncate className="text-text max-w-[180px]">
                        {event.agent_family}
                      </TableCell>
                      <TableCell mono truncate className="text-text-muted max-w-[200px]">
                        {event.source_endpoint}
                      </TableCell>
                      <TableCell mono className="hidden md:table-cell text-text-faint">
                        {event.ip_address || '-'}
                      </TableCell>
                      <TableCell mono truncate className="hidden md:table-cell text-accent-text max-w-[140px]">
                        {event.canary_id || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>
            {/* Table Footer */}
            <div className="h-9 px-3 border-t border-border bg-bg-subtle flex items-center justify-between text-xs text-text-faint">
              <span>Showing {filteredEvents.length} of {events.length}</span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-text-faint hover:text-text transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<div className="text-xs text-text-faint py-8">Loading events…</div>}>
      <EventsContent />
    </Suspense>
  );
}
