/**
 * Bot / crawler user-agent detection.
 *
 * Pure, dependency-free and separately unit-tested so the matching rules can be
 * reasoned about on their own — they decide what never reaches the error
 * tracker, and a wrong rule silently hides real user errors.
 *
 * Background: the 2026-09-15 GlitchTip burst was 1,613 ChunkLoadError events
 * across 98 issues, all from automated sweeps of the marketing routes. See
 * docs/ready-set/reports/2026-09-21-glitchtip-triage.md.
 */

/** Crawlers seen hitting readysetllc.com, matched by name. */
const NAMED_BOTS = [
  'bytespider',
  'googlebot',
  'bingbot',
  'ahrefsbot',
  'semrushbot',
  'petalbot',
  'headlesschrome',
] as const;

/**
 * Generic catch-all for crawlers we have not named yet.
 *
 * The trailing `\b` keeps device model strings out: "CUBOT_X30" does not match
 * (`_` is a word character), while "SomeNewBot/1.0", "ExampleCrawler/3.2" and a
 * trailing "Bytespider" all do. A bare "CUBOT " still matches — an accepted
 * trade-off: the cost is a dropped error event from a rare budget handset, not
 * a broken user.
 */
const GENERIC_BOT_PATTERN = /(bot|crawler|spider)\b/i;

/**
 * True when the user agent belongs to a bot, crawler or headless browser.
 * Events from these never represent a user-facing failure.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;

  const normalized = userAgent.toLowerCase();

  if (NAMED_BOTS.some((bot) => normalized.includes(bot))) return true;

  return GENERIC_BOT_PATTERN.test(normalized);
}
