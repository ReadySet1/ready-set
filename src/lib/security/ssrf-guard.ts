/**
 * SSRF guard for outbound HTTP requests.
 *
 * Blocks loopback, link-local, RFC1918 private ranges, and (in production)
 * non-https URLs. Use before any fetch whose URL comes from configuration
 * the application doesn't fully control (env vars, DB-backed partner
 * registry, etc.) so a misconfigured row can't pivot into internal services.
 *
 * This is a hostname/IP-literal check. It does NOT resolve DNS — a hostname
 * that resolves to a private IP at request time will pass; pair with a
 * resolving check at the network layer if that threat model matters.
 */

const PRIVATE_LITERAL_BLOCKLIST = new Set<string>([
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '::',
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return false;
  const [a, b] = octets as [number, number, number, number];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/**
 * Decode the trailing 32 bits of an IPv6 address (last two hex groups, or a
 * dotted IPv4 tail) into dotted-quad form. Returns null if the input doesn't
 * look like one of those embedded forms.
 *
 * Note: the WHATWG URL parser normalizes `[::ffff:127.0.0.1]` to
 * `[::ffff:7f00:1]`, so we must accept both the dotted and the hex
 * representations.
 */
function decodeEmbeddedIPv4(tail: string): string | null {
  if (/^[0-9.]+$/.test(tail)) return tail;
  const hexMatch = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hexMatch || !hexMatch[1] || !hexMatch[2]) return null;
  const hi = parseInt(hexMatch[1], 16);
  const lo = parseInt(hexMatch[2], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  const a = (hi >> 8) & 0xff;
  const b = hi & 0xff;
  const c = (lo >> 8) & 0xff;
  const d = lo & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

function isPrivateIPv6(host: string): boolean {
  const lower = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80:')) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d, normalized to ::ffff:H:H) — without
  // this, a URL like http://[::ffff:127.0.0.1]/ slips past every other
  // check and resolves to loopback through the IPv6 stack.
  const v4MapMatch = lower.match(/^::ffff:(.+)$/);
  if (v4MapMatch && v4MapMatch[1]) {
    const decoded = decodeEmbeddedIPv4(v4MapMatch[1]);
    if (decoded && isPrivateIPv4(decoded)) return true;
  }
  // IPv4-compatible IPv6 (::a.b.c.d, normalized to ::H:H), deprecated but
  // still routable.
  const v4CompatMatch = lower.match(/^::([^:]+:[^:]+|[0-9.]+)$/);
  if (v4CompatMatch && v4CompatMatch[1]) {
    const decoded = decodeEmbeddedIPv4(v4CompatMatch[1]);
    if (decoded && isPrivateIPv4(decoded)) return true;
  }
  return false;
}

export interface SsrfGuardOptions {
  requireHttps?: boolean;
}

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

export function checkOutboundUrl(
  rawUrl: string,
  opts: SsrfGuardOptions = {}
): SsrfCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  const requireHttps = opts.requireHttps ?? process.env.NODE_ENV === 'production';

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: `Protocol not allowed: ${parsed.protocol}` };
  }

  if (requireHttps && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'HTTPS required in production' };
  }

  const host = parsed.hostname.toLowerCase();

  if (PRIVATE_LITERAL_BLOCKLIST.has(host)) {
    return { ok: false, reason: `Blocked host: ${host}` };
  }

  if (isPrivateIPv4(host)) {
    return { ok: false, reason: `Private IPv4 address: ${host}` };
  }

  if (isPrivateIPv6(host)) {
    return { ok: false, reason: `Private IPv6 address: ${host}` };
  }

  return { ok: true };
}

/**
 * Throws if the URL fails the SSRF check. Convenience wrapper for callers
 * that want to fail fast.
 */
export function assertSafeOutboundUrl(rawUrl: string, opts?: SsrfGuardOptions): void {
  const result = checkOutboundUrl(rawUrl, opts);
  if (!result.ok) {
    throw new Error(`Outbound URL rejected by SSRF guard: ${result.reason}`);
  }
}
