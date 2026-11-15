'use client';

import React, { useMemo } from 'react';
import { TelemetryStats, TimelineBucket } from './DashboardContext';
import { EmptyState } from '../ui/EmptyState';
import { Tooltip } from '../ui/Tooltip';
import {
  EVENT_TYPES,
  SEVERITY_LEVELS,
  SEVERITY_COLORS,
  SEVERITY_COPY,
  getEventTypeCopy,
  severityTooltipText,
} from '@/lib/event-copy';
import { EventSeverity } from '@/lib/types';
import { formatHourRange, formatHourTick } from '@/lib/format';

interface ActivityChartProps {
  stats: TelemetryStats | null;
}

interface HourBucket {
  start: Date;
  end: Date;
  key: string;
  count: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  isCurrent: boolean;
}

function asBucket(value: TimelineBucket | number | undefined): TimelineBucket {
  if (!value) return { count: 0, byType: {}, bySeverity: {} };
  if (typeof value === 'number') return { count: value, byType: {}, bySeverity: {} };
  return value;
}

export function ActivityChart({ stats }: ActivityChartProps) {
  const buckets: HourBucket[] = useMemo(() => {
    const now = new Date();
    const list: HourBucket[] = [];
    for (let i = 23; i >= 0; i--) {
      const start = new Date(now.getTime() - i * 60 * 60 * 1000);
      start.setMinutes(0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const key = start.toISOString().slice(0, 13) + ':00';
      const raw = asBucket(stats?.timelineBuckets?.[key]);
      list.push({
        start,
        end,
        key,
        count: raw.count,
        byType: raw.byType || {},
        bySeverity: raw.bySeverity || {},
        isCurrent: i === 0,
      });
    }
    return list;
  }, [stats]);

  const totalActivity = buckets.reduce((sum, b) => sum + b.count, 0);
  const yMax = Math.max(...buckets.map((b) => b.count), 1);
  const yTicks = Array.from(new Set([0, Math.round(yMax / 2), yMax])).sort((a, b) => a - b);

  if (totalActivity === 0) {
    return (
      <EmptyState
        title="No activity yet"
        sentence="Events appear here as agents reach your decoys."
      />
    );
  }

  const plotH = 96;

  return (
    <div className="pt-1 space-y-3">
      <p className="text-[12px] text-text-faint leading-4">
        Events per hour in your local time.
      </p>

      <div className="flex gap-2">
        <div className="relative w-7 shrink-0" style={{ height: plotH }} aria-hidden="true">
          {yTicks.map((tick) => {
            const top = plotH - (tick / yMax) * plotH;
            return (
              <div
                key={tick}
                className="absolute right-0 -translate-y-1/2 text-[11px] leading-3 text-text-faint tabular-nums pr-1"
                style={{ top }}
              >
                {tick}
              </div>
            );
          })}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative" style={{ height: plotH }}>
            {yTicks.map((tick) => {
              const top = plotH - (tick / yMax) * plotH;
              return (
                <div
                  key={tick}
                  className="absolute left-0 right-0 border-t border-border"
                  style={{ top }}
                />
              );
            })}
            <div className="absolute inset-0 flex items-end gap-px">
              {buckets.map((b) => {
                const stack = SEVERITY_LEVELS.map((sev) => ({
                  sev,
                  count: b.bySeverity[sev] || 0,
                })).filter((s) => s.count > 0);
                const segments =
                  stack.length > 0
                    ? stack
                    : b.count > 0
                      ? [{ sev: 'info' as EventSeverity, count: b.count }]
                      : [];
                const typeLines = EVENT_TYPES.filter((t) => b.byType[t]).map((t) => (
                  <div key={t}>
                    {getEventTypeCopy(t).label}: {b.byType[t]}
                  </div>
                ));
                const height = b.count > 0 ? Math.max(4, (b.count / yMax) * plotH) : 0;

                return (
                  <Tooltip
                    key={b.key}
                    className="min-w-0 flex-1 h-full items-end justify-center"
                    content={
                      <span className="block text-left space-y-0.5">
                        <span className="block font-medium text-text">
                          {formatHourRange(b.start, b.end)}
                        </span>
                        <span className="block">
                          {b.count} {b.count === 1 ? 'event' : 'events'}
                        </span>
                        {typeLines.length > 0 ? (
                          <span className="block text-text-muted">{typeLines}</span>
                        ) : null}
                      </span>
                    }
                  >
                    <button
                      type="button"
                      aria-label={`${formatHourRange(b.start, b.end)}, ${b.count} events`}
                      className="relative w-full h-full bg-transparent border-0 p-0 cursor-pointer"
                    >
                      <span
                        className="absolute bottom-0 left-0.5 right-0.5 flex flex-col-reverse overflow-hidden rounded-[2px] pointer-events-none"
                        style={{ height }}
                      >
                        {segments.map((seg) => (
                          <span
                            key={seg.sev}
                            className="w-full block"
                            style={{
                              height: `${(seg.count / (b.count || 1)) * 100}%`,
                              minHeight: 2,
                              backgroundColor: SEVERITY_COLORS[seg.sev].dot,
                              opacity: b.isCurrent ? 1 : 0.85,
                            }}
                          />
                        ))}
                      </span>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          <div className="relative h-5 mt-1">
            {buckets.map((b, idx) => {
              const show = idx % 3 === 0 || idx === buckets.length - 1;
              if (!show) return null;
              return (
                <span
                  key={b.key}
                  className="absolute text-[11px] leading-3 text-text-faint -translate-x-1/2 whitespace-nowrap tabular-nums"
                  style={{ left: `${((idx + 0.5) / buckets.length) * 100}%` }}
                >
                  {formatHourTick(b.start)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
        {([...SEVERITY_LEVELS] as EventSeverity[]).slice().reverse().map((sev) => {
          const colors = SEVERITY_COLORS[sev];
          const copy = SEVERITY_COPY[sev];
          return (
            <Tooltip key={sev} content={severityTooltipText(sev)}>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-text-muted">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: colors.dot }}
                  aria-hidden="true"
                />
                {copy.label}
              </span>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
