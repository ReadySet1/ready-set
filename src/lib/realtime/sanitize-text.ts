/**
 * Dependency-free plain-text sanitizer for realtime payload strings.
 *
 * Mirrors the observable behavior of `InputSanitizer.sanitizeText`
 * (src/lib/validation.ts — DOMPurify with ALLOWED_TAGS: [], KEEP_CONTENT:
 * true, then trim) for the simple strings realtime payloads carry (driver
 * names, statuses, addresses, notes): strip every HTML tag, drop the content
 * of dangerous container tags, keep the surrounding text, trim.
 *
 * Deliberately NOT DOMPurify: isomorphic-dompurify constructs a JSDOM window
 * at module evaluation, and jsdom is a webpack external whose
 * html-encoding-sniffer dependency CJS-requires an ESM-only package —
 * importing it from the realtime schemas broke every /driver SSR with
 * ERR_REQUIRE_ESM. Realtime payloads are never rendered as HTML, so a
 * tag-stripper is sufficient here.
 */

/** Container tags whose text content must be dropped, not kept. */
const BLOCK_CONTENT_TAGS =
  /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const HTML_COMMENTS = /<!--[\s\S]*?-->/g;

/**
 * Anything that looks like an HTML tag: `<name ...>` or `</name ...>`.
 * Requires a letter after `<` so comparisons like "1 < 2" survive.
 */
const HTML_TAGS = /<\/?[a-zA-Z][^>]*>/g;

export function sanitizePlainText(input: string | null | undefined): string {
  if (input == null) return '';
  let output = String(input);
  // Loop until stable so stripping one tag can never reassemble fragments
  // into a new tag (e.g. "<<b>script>...") that would survive a single pass.
  let previous: string;
  do {
    previous = output;
    output = output
      .replace(BLOCK_CONTENT_TAGS, '')
      .replace(HTML_COMMENTS, '')
      .replace(HTML_TAGS, '');
  } while (output !== previous);
  return output.trim();
}
