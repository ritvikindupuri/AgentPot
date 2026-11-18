'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { DecoyFlag } from '@/lib/settings';

const DECOY_LABELS: { key: DecoyFlag; label: string }[] = [
  { key: 'mcp', label: 'MCP server (/mcp)' },
  { key: 'docs', label: 'Docs (/docs)' },
  { key: 'llms.txt', label: 'llms.txt' },
  { key: 'manifests', label: 'Manifests (/.well-known)' },
];

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('Corvane');
  const [hostname, setHostname] = useState('');
  const [resolvedHost, setResolvedHost] = useState('');
  const [decoys, setDecoys] = useState<Record<DecoyFlag, boolean>>({
    mcp: true,
    docs: true,
    'llms.txt': true,
    manifests: true,
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        if (cancelled) return;
        setCompanyName(data.company_name || 'Corvane');
        setHostname(data.decoy_hostname || '');
        setResolvedHost(data.resolved_hostname || '');
        if (data.decoys_enabled) setDecoys((prev) => ({ ...prev, ...data.decoys_enabled }));
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Saving...');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          decoy_hostname: hostname,
          decoys_enabled: decoys,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setCompanyName(data.company_name);
      setHostname(data.decoy_hostname || '');
      setResolvedHost(data.resolved_hostname || '');
      setStatus('Saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Company settings</h1>
        <p className="text-[13px] text-text-muted mt-1">
          These values are shown on public bait surfaces for this tenant. Leave the hostname blank to use the current host.
        </p>
      </div>
      <Card className="p-4">
        {loading ? (
          <p className="text-[13px] text-text-muted">Loading...</p>
        ) : (
          <form onSubmit={onSave} className="space-y-4">
            <label className="block text-[13px]">
              <span className="text-text-muted">Company name</span>
              <Input className="mt-1" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </label>
            <label className="block text-[13px]">
              <span className="text-text-muted">Decoy hostname</span>
              <Input
                className="mt-1"
                value={hostname}
                placeholder={resolvedHost || 'current host'}
                onChange={(e) => setHostname(e.target.value)}
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-[13px] text-text-muted">Enabled decoys</legend>
              {DECOY_LABELS.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={decoys[item.key] !== false}
                    onChange={(e) => setDecoys((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              {status ? <span className="text-[13px] text-text-muted">{status}</span> : null}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
