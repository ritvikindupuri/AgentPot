'use client';

import React from 'react';
import { HoneypotEvent } from '@/lib/types';
import { EventBadge, SeverityPill } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { toDisplayRecord } from '@/lib/display-record';
import { sanitizeHeaders } from '@/lib/headers';
import { eventScorePoints, getEventTypeCopy, RISK_SCORE_TOOLTIP } from '@/lib/event-copy';
import { formatFriendlyTime, formatFullTimestamp } from '@/lib/format';

function KeyValueTable({ rows }: { rows: { key: string; value: string }[] }) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-text-faint">None recorded.</p>;
  }
  return (
    <dl className="grid grid-cols-[minmax(0,38%)_minmax(0,62%)] gap-x-3 gap-y-1.5 text-[12px] leading-4">
      {rows.map((row) => (
        <React.Fragment key={row.key}>
          <dt className="text-text-faint truncate" title={row.key}>
            {row.key}
          </dt>
          <dd className="font-mono text-text-muted break-all">{row.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[12px] font-medium text-text leading-4">{title}</h4>
      {children}
    </div>
  );
}

interface EventDetailProps {
  event: HoneypotEvent;
}

export function EventDetail({ event }: EventDetailProps) {
  const copy = getEventTypeCopy(event.event_type);
  const toolName =
    (typeof event.payload?.tool === 'string' && event.payload.tool) ||
    (typeof event.payload?.toolName === 'string' && event.payload.toolName) ||
    undefined;
  const points = eventScorePoints(event.event_type, toolName);
  const payload = toDisplayRecord(event.payload);
  const headers = toDisplayRecord(sanitizeHeaders(event.headers || {}));

  return (
    <div className="mt-2 space-y-3 p-3 bg-bg border border-border rounded-md">
      <Section title="What happened">
        <p className="text-[12px] text-text leading-4">
          {copy.label}: {copy.description}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <EventBadge type={event.event_type} />
          <SeverityPill severity={event.severity} />
          <Tooltip content={RISK_SCORE_TOOLTIP}>
            <span className="text-[12px] text-text-faint tabular-nums">
              +{points} risk
            </span>
          </Tooltip>
        </div>
        <div className="text-[12px] text-text-muted">
          <Tooltip content={formatFullTimestamp(event.created_at)}>
            <time dateTime={event.created_at} className="cursor-default">
              {formatFriendlyTime(event.created_at)}
            </time>
          </Tooltip>
        </div>
        {event.canary_id && (
          <div className="text-[12px]">
            <span className="text-text-faint">Canary: </span>
            <span className="font-mono text-accent-text">{event.canary_id}</span>
          </div>
        )}
      </Section>

      <Section title="Request">
        <KeyValueTable
          rows={[
            { key: 'Method', value: event.request_method || 'GET' },
            { key: 'Endpoint', value: event.source_endpoint || '-' },
            ...(event.ip_address ? [{ key: 'IP', value: event.ip_address }] : []),
            ...(event.agent_family ? [{ key: 'Agent', value: event.agent_family }] : []),
            ...payload.rows,
          ]}
        />
        {payload.truncatedBytes ? (
          <p className="text-[12px] text-text-faint">
            Stored payload was capped at a few kilobytes ({payload.truncatedBytes} bytes originally).
          </p>
        ) : null}
      </Section>

      <Section title="Headers">
        <KeyValueTable rows={headers.rows} />
        {headers.truncatedBytes ? (
          <p className="text-[12px] text-text-faint">
            Stored headers were capped ({headers.truncatedBytes} bytes originally).
          </p>
        ) : null}
      </Section>
    </div>
  );
}
