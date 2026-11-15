/**
 * Turn a stored payload or headers object into readable key/value rows.
 * Handles the free-tier cap shape { _truncated, _original_bytes, preview }
 * so the preview string is parsed instead of shown double-escaped.
 */

export interface DisplayRow {
  key: string;
  value: string;
}

export interface DisplayRecord {
  rows: DisplayRow[];
  truncatedBytes?: number;
}

function formatValue(value: unknown): string {
  if (value == null) return 'none';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function rowsFromObject(obj: Record<string, unknown>): DisplayRow[] {
  return Object.entries(obj)
    .filter(([key]) => key !== '_truncated' && key !== '_original_bytes')
    .map(([key, value]) => ({ key, value: formatValue(value) }));
}

export function toDisplayRecord(input: unknown): DisplayRecord {
  if (input == null) return { rows: [] };
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { rows: [{ key: 'value', value: formatValue(input) }] };
  }

  const obj = input as Record<string, unknown>;

  if (obj._truncated && typeof obj.preview === 'string') {
    const truncatedBytes =
      typeof obj._original_bytes === 'number' ? obj._original_bytes : undefined;
    try {
      const parsed = JSON.parse(obj.preview);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { rows: rowsFromObject(parsed as Record<string, unknown>), truncatedBytes };
      }
      return { rows: [{ key: 'value', value: formatValue(parsed) }], truncatedBytes };
    } catch {
      return { rows: [{ key: 'preview', value: obj.preview }], truncatedBytes };
    }
  }

  return { rows: rowsFromObject(obj) };
}
