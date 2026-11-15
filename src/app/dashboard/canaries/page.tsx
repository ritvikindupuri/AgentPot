'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CANARY_LIBRARY, PLANTED_CREDENTIALS } from '@/lib/canaries';
import { useDashboardData } from '@/components/dashboard/DashboardContext';
import { NeutralBadge } from '@/components/ui/Badge';
import { formatRelativeTime } from '@/lib/format';
import {
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/Table';

const TECHNIQUE_LABELS: Record<string, string> = {
  hidden_text: 'Hidden text',
  html_comment: 'HTML comment',
  markdown_injection: 'Markdown',
  zero_width: 'Zero-width',
  alt_text: 'Alt text',
  system_prompt_override: 'System override',
  credential_leak: 'Credential leak',
};

export default function CanariesPage() {
  const router = useRouter();
  const { events, stats } = useDashboardData();

  // Map canary ID to hits count and latest event
  const canaryHitsMap = new Map<string, { hits: number; lastHit: string | null }>();
  for (const canary of CANARY_LIBRARY) {
    const hitsFromStats = stats?.canaryStats?.find((s) => s.canary.id === canary.id)?.hits;
    const eventsForCanary = events.filter((e) => e.canary_id === canary.id);
    const hits = hitsFromStats !== undefined ? hitsFromStats : eventsForCanary.length;
    const lastHitEvent = eventsForCanary[0]; // Events are ordered newest first
    canaryHitsMap.set(canary.id, {
      hits,
      lastHit: lastHitEvent?.created_at || null,
    });
  }

  // Planted credentials uses and last use
  const credUsageMap = new Map<string, { uses: number; lastUse: string | null }>();
  for (const cred of PLANTED_CREDENTIALS) {
    const usesFromStats = stats?.credentialUses?.[cred.key_id];
    const eventsForCred = events.filter(
      (e) =>
        e.payload?.credentialKey === cred.key_id ||
        e.payload?.key === cred.key_id ||
        (e.canary_id === cred.canary_id && e.event_type === 'credential_use')
    );
    const uses = usesFromStats !== undefined ? usesFromStats : eventsForCred.length;
    const lastUseEvent = eventsForCred[0];
    credUsageMap.set(cred.key_id, {
      uses,
      lastUse: lastUseEvent?.created_at || null,
    });
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Injection Canaries */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text leading-5">
          Injection canaries
        </h2>
        <TableContainer>
          <TableHead>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell className="w-36">Technique</TableHeaderCell>
            <TableHeaderCell className="w-32">Location</TableHeaderCell>
            <TableHeaderCell align="right" className="w-20">Hits</TableHeaderCell>
            <TableHeaderCell className="w-28">Last hit</TableHeaderCell>
          </TableHead>
          <TableBody>
            {CANARY_LIBRARY.map((canary) => {
              const meta = canaryHitsMap.get(canary.id) || { hits: 0, lastHit: null };
              const techLabel = TECHNIQUE_LABELS[canary.technique] || canary.technique;

              return (
                <TableRow
                  key={canary.id}
                  onClick={() => router.push(`/dashboard/events?canary=${encodeURIComponent(canary.id)}`)}
                >
                  <TableCell>
                    <div className="font-medium text-text text-[13px] leading-5">
                      {canary.name}
                    </div>
                    <div className="font-mono text-xs text-text-faint">
                      {canary.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <NeutralBadge label={techLabel} />
                  </TableCell>
                  <TableCell mono className="text-text-muted">
                    {canary.location}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`font-mono ${meta.hits > 0 ? 'text-text font-medium' : 'text-text-faint'}`}
                  >
                    {meta.hits}
                  </TableCell>
                  <TableCell className="text-text-faint text-xs whitespace-nowrap">
                    {meta.lastHit ? formatRelativeTime(meta.lastHit) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableContainer>
      </section>

      {/* Section 2: Planted Keys */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text leading-5">
          Planted keys
        </h2>
        <TableContainer>
          <TableHead>
            <TableHeaderCell>Key name</TableHeaderCell>
            <TableHeaderCell className="w-32">Location</TableHeaderCell>
            <TableHeaderCell align="right" className="w-20">Uses</TableHeaderCell>
            <TableHeaderCell className="w-28">Last use</TableHeaderCell>
          </TableHead>
          <TableBody>
            {PLANTED_CREDENTIALS.map((cred) => {
              const meta = credUsageMap.get(cred.key_id) || { uses: 0, lastUse: null };
              const maskedKey = `${cred.key_id.slice(0, 6)}…`;

              return (
                <TableRow key={cred.key_id}>
                  <TableCell>
                    <div className="font-medium text-text text-[13px] leading-5">
                      {cred.key_name}
                    </div>
                    <div className="font-mono text-xs text-text-faint">
                      {maskedKey}
                    </div>
                  </TableCell>
                  <TableCell mono className="text-text-muted">
                    {cred.location}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`font-mono ${meta.uses > 0 ? 'text-text font-medium' : 'text-text-faint'}`}
                  >
                    {meta.uses}
                  </TableCell>
                  <TableCell className="text-text-faint text-xs whitespace-nowrap">
                    {meta.lastUse ? formatRelativeTime(meta.lastUse) : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </TableContainer>
      </section>
    </div>
  );
}
