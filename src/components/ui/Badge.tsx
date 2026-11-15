import React from 'react';
import { EventSeverity, EventType } from '@/lib/types';

interface SeverityPillProps {
  severity: EventSeverity | string;
  className?: string;
}

export function SeverityPill({ severity, className = '' }: SeverityPillProps) {
  const sev = (severity || 'info').toLowerCase();

  let textCol = '#9BA1AE';
  let bgCol = 'rgba(155,161,174,0.10)';
  let dotCol = '#6B7280';

  if (sev === 'critical') {
    textCol = '#FF6369';
    bgCol = 'rgba(255,99,105,0.12)';
    dotCol = '#FF6369';
  } else if (sev === 'high') {
    textCol = '#FF9B52';
    bgCol = 'rgba(255,155,82,0.12)';
    dotCol = '#FF9B52';
  } else if (sev === 'medium') {
    textCol = '#F5C451';
    bgCol = 'rgba(245,196,81,0.12)';
    dotCol = '#F5C451';
  } else if (sev === 'low') {
    textCol = '#6CB6FF';
    bgCol = 'rgba(108,182,255,0.12)';
    dotCol = '#6CB6FF';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-xs font-medium whitespace-nowrap select-none ${className}`}
      style={{ color: textCol, backgroundColor: bgCol }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotCol }}
        aria-hidden="true"
      />
      <span>{sev}</span>
    </span>
  );
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  crawl: 'Crawl',
  injection_fired: 'Injection',
  tool_call: 'Tool call',
  credential_use: 'Credential',
  exfil_attempt: 'Exfiltration',
  mcp_connect: 'MCP connect',
  tool_discovery: 'Tool discovery',
};

interface EventBadgeProps {
  type: EventType | string;
  className?: string;
}

export function EventBadge({ type, className = '' }: EventBadgeProps) {
  const label = EVENT_TYPE_LABELS[type] || type;

  return (
    <span
      className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium text-text-muted bg-white/[0.05] whitespace-nowrap select-none ${className}`}
    >
      {label}
    </span>
  );
}

interface NeutralBadgeProps {
  label: string;
  className?: string;
}

export function NeutralBadge({ label, className = '' }: NeutralBadgeProps) {
  return (
    <span
      className={`inline-flex items-center h-5 px-2 rounded-full text-xs font-medium text-text-muted bg-white/[0.05] whitespace-nowrap select-none ${className}`}
    >
      {label}
    </span>
  );
}
