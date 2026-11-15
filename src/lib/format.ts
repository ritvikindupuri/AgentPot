export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const now = Date.now();
  const time = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - time) / 1000);

  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function formatShortRelativeTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const now = Date.now();
  const time = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - time) / 1000);

  if (diffSec < 60) return `${Math.max(0, diffSec)}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export function formatShortTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toTimeString().slice(0, 8);
  } catch {
    return dateStr;
  }
}
