'use client';

import React from 'react';
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
import { formatShortRelativeTime, formatFullTimestamp } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { ActivityChart } from '@/components/dashboard/ActivityChart';

export default function OverviewPage() {
  const { events, stats, openSessionDrawer } = useDashboardData();

  // 1. KPI row
  const totalEvents = stats?.totalEvents ?? events.length;
  const totalSessions = stats?.totalSessions ?? 0;

  const injectionCount = stats?.eventTypeCounts?.injection_fired ?? 0;
  const credCount = stats?.eventTypeCounts?.credential_use ?? 0;
  const canaryHits = injectionCount + credCount;

  const criticalCount = events.filter((e) => e.severity === 'critical').length;

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
        <ActivityChart stats={stats} />
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
                        <Tooltip content={formatFullTimestamp(event.created_at)}>
                          <time dateTime={event.created_at}>{formatShortRelativeTime(event.created_at)}</time>
                        </Tooltip>
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
