/**
 * Strip token-bearing and platform-secret headers before storage or display.
 * Keeps ordinary request metadata such as user-agent, accept, content-type,
 * and non-secret x-forwarded-for / host / proto / port values.
 */

const STRIP_EXACT = new Set([
  'authorization',
  'forwarded',
  'proxy-authorization',
  'www-authenticate',
  'authentication',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-amz-security-token',
  'x-vault-token',
  'x-agent-key',
  'x-agent-ingest-key',
  'x-ingest-key',
]);

const SAFE_X_FORWARDED = new Set(['for', 'host', 'proto', 'port', 'scheme']);

const TOKENISH = /token|secret|password|passwd|api-?key|auth|signature|credential/i;

export function isSensitiveHeaderName(name: string): boolean {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  if (key.startsWith('x-vercel-')) return true;
  if (STRIP_EXACT.has(key)) return true;
  if (key.startsWith('x-forwarded-')) {
    const rest = key.slice('x-forwarded-'.length);
    if (SAFE_X_FORWARDED.has(rest)) return false;
    return true;
  }
  return TOKENISH.test(key);
}

export function sanitizeHeaders(
  headers?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!isSensitiveHeaderName(name)) {
      out[name] = value;
    }
  }
  return out;
}

/** Recursively sanitize a headers object that may already be stored. */
export function sanitizeStoredHeaders(value: unknown): { cleaned: unknown; changed: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { cleaned: value ?? {}, changed: false };
  }
  const record = value as Record<string, unknown>;
  const cleaned = sanitizeHeaders(record);
  const changed =
    Object.keys(record).length !== Object.keys(cleaned).length ||
    Object.keys(record).some((k) => isSensitiveHeaderName(k));
  return { cleaned, changed };
}

export function headersContainOidcToken(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).some(
    (k) => k.toLowerCase() === 'x-vercel-oidc-token'
  );
}
