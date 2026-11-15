'use client';

import React, { useMemo } from 'react';
import { useDashboardData } from '@/components/dashboard/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime, formatFullTimestamp } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';
import { RISK_SCORE_TOOLTIP } from '@/lib/event-copy';
import {
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

function getRiskBarColor(score: number): string {
  if (score >= 75) return '#FF6369';
  if (score >= 50) return '#FF9B52';
  if (score >= 25) return '#F5C451';
  return '#6CB6FF';
}

export default function SessionsPage() {
  const { sessions, openSessionDrawer, searchTerm } = useDashboardData();

  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.agent_family.toLowerCase().includes(term) ||
          s.user_agent?.toLowerCase().includes(term) ||
          s.ip_address?.toLowerCase().includes(term) ||
          s.id.toLowerCase().includes(term)
      );
    }

    return result.sort(
      (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    );
  }, [sessions, searchTerm]);

  return (
    <div className="space-y-4">
      {sessions.length === 0 ? (
        <div className="border border-border rounded-lg bg-surface">
          <EmptyState
            title="No sessions yet"
            sentence="Sessions are created on the first request from an agent."
          />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="border border-border rounded-lg bg-surface">
          <EmptyState
            title="No matching sessions"
            sentence="Try a different search term."
          />
        </div>
      ) : (
        <TableContainer>
          <TableHead>
            <TableHeaderCell>Agent</TableHeaderCell>
            <TableHeaderCell className="w-36">
              <Tooltip content={RISK_SCORE_TOOLTIP}>
                <span>Risk</span>
              </Tooltip>
            </TableHeaderCell>
            <TableHeaderCell align="right" className="w-20">Events</TableHeaderCell>
            <TableHeaderCell className="w-28">First seen</TableHeaderCell>
            <TableHeaderCell className="w-28">Last seen</TableHeaderCell>
          </TableHead>
          <TableBody>
            {filteredSessions.map((session) => {
              const riskScore = session.severity_score ?? 0;
              const barColor = getRiskBarColor(riskScore);
              const barFillWidth = Math.min(48, Math.max(2, (riskScore / 100) * 48));

              return (
                <TableRow
                  key={session.id}
                  onClick={() => openSessionDrawer(session.id)}
                >
                  <TableCell>
                    <div className="font-medium text-text text-[13px] leading-5">
                      {session.agent_family}
                    </div>
                    <div className="text-xs text-text-faint truncate max-w-sm">
                      {session.user_agent || session.ip_address || 'Unknown agent'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip content={RISK_SCORE_TOOLTIP}>
                        <span className="font-mono text-xs text-text w-6 text-right tabular-nums">
                          {riskScore}
                        </span>
                      </Tooltip>
                      <div className="w-12 h-1 bg-border rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barFillWidth}px`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell align="right" className="font-mono text-text">
                    {session.event_count}
                  </TableCell>
                  <TableCell className="text-text-faint text-xs whitespace-nowrap">
                    <Tooltip content={formatFullTimestamp(session.first_seen)}>
                      <time dateTime={session.first_seen}>{formatRelativeTime(session.first_seen)}</time>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-text-faint text-xs whitespace-nowrap">
                    <Tooltip content={formatFullTimestamp(session.last_seen)}>
                      <time dateTime={session.last_seen}>{formatRelativeTime(session.last_seen)}</time>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableContainer>
      )}
    </div>
  );
}
