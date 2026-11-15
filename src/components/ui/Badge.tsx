'use client';

import React from 'react';
import { EventSeverity, EventType } from '@/lib/types';
import {
  getEventTypeCopy,
  eventTypeSummary,
  getSeverityCopy,
  severityTooltipText,
  SEVERITY_COLORS,
} from '@/lib/event-copy';
import { Tooltip } from './Tooltip';

interface SeverityPillProps {
  severity: EventSeverity | string;
  className?: string;
}

export function SeverityPill({ severity, className = '' }: SeverityPillProps) {
  const copy = getSeverityCopy(severity);
  const key = (severity || 'info').toLowerCase() as keyof typeof SEVERITY_COLORS;
  const colors = SEVERITY_COLORS[key] ?? SEVERITY_COLORS.info;

  return (
    <Tooltip
      content={
        <span>
          <span className="font-medium text-text">{copy.label}. </span>
          {severityTooltipText(severity)}
        </span>
      }
    >
      <span
        className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap select-none ${className}`}
        style={{ color: colors.text, backgroundColor: colors.bg }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: colors.dot }}
          aria-hidden="true"
        />
        <span>{copy.label}</span>
      </span>
    </Tooltip>
  );
}

interface EventBadgeProps {
  type: EventType | string;
  className?: string;
}

export function EventBadge({ type, className = '' }: EventBadgeProps) {
  const copy = getEventTypeCopy(type);

  return (
    <Tooltip content={eventTypeSummary(type)}>
      <span
        className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium text-text-muted bg-white/[0.05] whitespace-nowrap select-none ${className}`}
      >
        {copy.label}
      </span>
    </Tooltip>
  );
}

interface NeutralBadgeProps {
  label: string;
  className?: string;
  tooltip?: string;
}

export function NeutralBadge({ label, className = '', tooltip }: NeutralBadgeProps) {
  const pill = (
    <span
      className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium text-text-muted bg-white/[0.05] whitespace-nowrap select-none ${className}`}
    >
      {label}
    </span>
  );
  return tooltip ? <Tooltip content={tooltip}>{pill}</Tooltip> : pill;
}
