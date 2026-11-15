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

export function formatFriendlyTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function formatFullTimestamp(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' });
  } catch {
    return dateStr;
  }
}

export function formatHourTick(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric' });
}

export function formatHourRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, opts)} to ${end.toLocaleTimeString(undefined, opts)}`;
}
