'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDashboardData } from '@/components/dashboard/DashboardContext';
import { KpiTile } from '@/components/ui/KpiTile';
import { Card } from '@/components/ui/Card';
import { SeverityPill, EventBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { formatShortRelativeTime } from '@/lib/format';

export default function OverviewPage() {
  const { events, stats, openSessionDrawer } = useDashboardData();
  const [hoveredBar, setHoveredBar] = useState<{ label: string; count: number } | null>(null);

  // 1. KPI row
  const totalEvents = stats?.totalEvents ?? events.length;
  const totalSessions = stats?.totalSessions ?? 0;

  const injectionCount = stats?.eventTypeCounts?.injection_fired ?? 0;
  const credCount = stats?.eventTypeCounts?.credential_use ?? 0;
  const canaryHits = injectionCount + credCount;

  const criticalCount = events.filter((e) => e.severity === 'critical').length;

  // 2. Activity chart: 24 hourly buckets
  const now = new Date();
  const buckets: Array<{ key: string; label: string; count: number; isCurrent: boolean }> = [];
  let totalActivity = 0;

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 13) + ':00';
    const hours = d.getHours().toString().padStart(2, '0');
    const label = `${hours}:00`;
    const count = stats?.timelineBuckets?.[key] || 0;
    totalActivity += count;
    buckets.push({
      key,
      label,
      count,
      isCurrent: i === 0,
    });
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  // 3. Recent events: latest 8
  const recentEvents = events.slice(0, 8);

  // 4. Top agents: up to 5
  const agentEntries = Object.entries(stats?.agentFamilyCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxAgentCount = Math.max(...agentEntries.map((e) => e[1]), 1);

  return (
    <div className="space-y-6">
      {/* 1. KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile caption="Events · 24h" value={totalEvents} />
        <KpiTile caption="Sessions" value={totalSessions} />
        <KpiTile caption="Canary hits" value={canaryHits} />
        <KpiTile caption="Critical" value={criticalCount} />
      </div>

      {/* 2. Activity Chart */}
      <Card title="Activity" action={<span>Last 24 hours</span>}>
        {totalActivity === 0 ? (
          <EmptyState
            title="No activity yet"
            sentence="Events appear here as agents reach your decoys."
          />
        ) : (
          <div className="pt-2">
            <div className="relative h-[120px] w-full">
              {hoveredBar && (
                <div className="absolute top-0 right-0 text-xs font-mono text-text-faint bg-surface border border-border px-2 py-0.5 rounded">
                  {hoveredBar.label} · {hoveredBar.count} events
                </div>
              )}
              <svg
                className="w-full h-[95px] overflow-visible"
                viewBox="0 0 720 80"
                preserveAspectRatio="none"
              >
                {/* Baseline */}
                <line
                  x1="0"
                  y1="79"
                  x2="720"
                  y2="79"
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                {buckets.map((b, idx) => {
                  const barWidth = 720 / buckets.length;
                  const innerWidth = Math.max(2, barWidth - 4);
                  const barHeight = b.count > 0 ? Math.max(4, (b.count / maxCount) * 72) : 0;
                  const x = idx * barWidth + 2;
                  const y = 79 - barHeight;

                  return (
                    <rect
                      key={b.key}
                      x={x}
                      y={y}
                      width={innerWidth}
                      height={barHeight}
                      fill="var(--accent)"
                      fillOpacity={b.isCurrent ? 1.0 : 0.7}
                      className="cursor-pointer transition-opacity duration-120 hover:opacity-100"
                      onMouseEnter={() => setHoveredBar({ label: b.label, count: b.count })}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <title>{`${b.label} · ${b.count} events`}</title>
                    </rect>
                  );
                })}
              </svg>
              {/* 3 x-labels: -24h, -12h, now */}
              <div className="flex justify-between items-center text-xs text-text-faint mt-2 select-none">
                <span>-24h</span>
                <span>-12h</span>
                <span>now</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Two columns (60/40) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Events (60%) */}
        <div className="lg:col-span-3">
          <Card
            title="Recent events"
            action={
              <Link
                href="/dashboard/events"
                className="text-text-muted hover:text-text text-xs transition-colors duration-120"
              >
                View all
              </Link>
            }
            padding={0}
          >
            {recentEvents.length === 0 ? (
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
            ) : (
              <TableContainer className="border-0 rounded-none rounded-b-lg">
                <TableHead>
                  <TableHeaderCell className="w-16">Time</TableHeaderCell>
                  <TableHeaderCell className="w-24">Event</TableHeaderCell>
                  <TableHeaderCell className="w-20">Severity</TableHeaderCell>
                  <TableHeaderCell>Agent</TableHeaderCell>
                  <TableHeaderCell>Endpoint</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {recentEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      onClick={() => openSessionDrawer(event.session_id)}
                    >
                      <TableCell className="text-text-faint text-xs whitespace-nowrap">
                        {formatShortRelativeTime(event.created_at)}
                      </TableCell>
                      <TableCell>
                        <EventBadge type={event.event_type} />
                      </TableCell>
                      <TableCell>
                        <SeverityPill severity={event.severity} />
                      </TableCell>
                      <TableCell truncate className="text-text">
                        {event.agent_family}
                      </TableCell>
                      <TableCell mono truncate className="text-text-muted">
                        {event.source_endpoint}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableContainer>
            )}
          </Card>
        </div>

        {/* Top Agents (40%) */}
        <div className="lg:col-span-2">
          <Card title="Top agents">
            {agentEntries.length === 0 ? (
              <EmptyState title="No agents yet" />
            ) : (
              <div className="space-y-3.5 pt-1">
                {agentEntries.map(([agentName, count]) => {
                  const pct = Math.min(100, Math.max(5, (count / maxAgentCount) * 100));
                  return (
                    <div key={agentName} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text font-medium truncate max-w-[200px]">
                          {agentName}
                        </span>
                        <span className="text-text-faint font-mono">
                          {count}
                        </span>
                      </div>
                      <div className="w-full h-0.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
