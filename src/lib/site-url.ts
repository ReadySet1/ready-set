/**
 * Canonical origin for this deployment.
 *
 * Every absolute URL the app builds for itself — auth callbacks, emailed
 * links, server-to-self fetches — must go through here. Before this module
 * each call site had its own fallback, and the fallbacks disagreed:
 * `undefined` (no fallback at all), `http://localhost:3000`,
 * `http://localhost:3001` and `https://ready-set.vercel.app`. On the VPS those
 * fail in different, silent ways.
 *
 * Two things worth knowing before changing this:
 *
 * 1. `NEXT_PUBLIC_SITE_URL` is inlined by `next build`, so it has to be passed
 *    as a Docker **build arg**. Setting it only as a runtime environment
 *    variable on the host leaves the built bundle with whatever value (or
 *    absence of one) it had at build time.
 * 2. The value is compared against browser `Origin` headers, which never carry
 *    a trailing slash or a path. Normalise before comparing — this is what
 *    broke the equivalent check on destino-sf.
 */

const PRODUCTION_FALLBACK = "https://readysetllc.com";
const DEVELOPMENT_FALLBACK = "http://localhost:3000";

/**
 * Reduce a configured URL or an incoming header to a bare origin
 * (`scheme://host[:port]`), or `null` when it cannot be understood.
 *
 * A value with no scheme is assumed to be https, since that is how these
 * fields are usually filled in by hand.
 */
export function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const { origin } = new URL(withScheme);
    // `new URL("http://")` throws, but other degenerate inputs can still
    // produce the string "null" for an opaque origin.
    return origin && origin !== "null" ? origin : null;
  } catch {
    return null;
  }
}

/** The origin this deployment serves from, never with a trailing slash. */
export function siteOrigin(): string {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  return process.env.NODE_ENV === "production"
    ? PRODUCTION_FALLBACK
    : DEVELOPMENT_FALLBACK;
}

/** Absolute URL for a path on this deployment. */
export function siteUrl(path: string = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${suffix}`;
}

/**
 * Origins accepted as "us" when validating an inbound request.
 *
 * The apex and `www` forms are treated as equivalent so that a deployment
 * configured with one does not reject browsers arriving on the other.
 */
export function allowedOrigins(): string[] {
  const origin = siteOrigin();
  const origins = new Set<string>([origin]);

  try {
    const url = new URL(origin);
    const { hostname } = url;

    if (hostname.startsWith("www.")) {
      url.hostname = hostname.slice(4);
      origins.add(url.origin);
    } else if (hostname.split(".").length >= 2 && !isIpAddress(hostname)) {
      url.hostname = `www.${hostname}`;
      origins.add(url.origin);
    }
  } catch {
    // `siteOrigin()` is always parseable; nothing to recover from here.
  }

  return [...origins];
}

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}
