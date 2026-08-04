import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export type DescriptionSegment =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string };

const CODE_PATTERN = /<code>([\s\S]*?)<\/code>/g;

export function parseDescription(
  input: string | undefined,
): DescriptionSegment[] {
  if (!input) return [];
  const segments: DescriptionSegment[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(CODE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", value: input.slice(lastIndex, start) });
    }
    segments.push({ kind: "code", value: match[1] ?? "" });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < input.length) {
    segments.push({ kind: "text", value: input.slice(lastIndex) });
  }
  return segments;
}

// Rich variant of the description sanitizer used by the Tasks Board.
// Same philosophy as parseDescription: parse a small whitelist of tags
// (<code>, <em>, <strong>, <br>, <a href>) into typed segments and render
// them as React elements — never dangerouslySetInnerHTML. Anything outside
// the whitelist (e.g. <script>, <b>, unknown attributes) stays literal text.
export type RichSegment =
  | { kind: "text"; value: string }
  | { kind: "br" }
  | { kind: "code" | "em" | "strong"; children: RichSegment[] }
  | { kind: "link"; href: string; children: RichSegment[] };

const RICH_TAG_PATTERN = /<(\/?)(code|em|strong|a|br)((?:\s[^<>]*)?)\/?>/gi;

function safeHref(attrs: string): string {
  const match = /href\s*=\s*"([^"]*)"/i.exec(attrs);
  const href = match?.[1] ?? "";
  return /^https?:\/\//i.test(href) || href.startsWith("/") ? href : "";
}

export function parseRichDescription(input: string | undefined): RichSegment[] {
  if (!input) return [];

  interface Frame {
    kind: "code" | "em" | "strong" | "link";
    tag: string;
    href: string;
    children: RichSegment[];
    raw: string; // original open-tag text, restored literally if never closed
  }

  const root: RichSegment[] = [];
  const stack: Frame[] = [];
  const top = (): RichSegment[] =>
    stack.length > 0 ? stack[stack.length - 1]!.children : root;

  let lastIndex = 0;
  for (const match of input.matchAll(RICH_TAG_PATTERN)) {
    const raw = match[0];
    const closing = match[1] === "/";
    const tag = (match[2] ?? "").toLowerCase();
    const attrs = match[3] ?? "";
    const start = match.index ?? 0;

    if (start > lastIndex) {
      top().push({ kind: "text", value: input.slice(lastIndex, start) });
    }
    lastIndex = start + raw.length;

    if (tag === "br") {
      if (!closing) top().push({ kind: "br" });
      continue;
    }

    if (!closing) {
      const kind = tag === "a" ? "link" : (tag as "code" | "em" | "strong");
      stack.push({
        kind,
        tag,
        href: tag === "a" ? safeHref(attrs) : "",
        children: [],
        raw,
      });
      continue;
    }

    const frame = stack[stack.length - 1];
    if (frame && frame.tag === tag) {
      stack.pop();
      if (frame.kind === "link") {
        if (frame.href) {
          top().push({
            kind: "link",
            href: frame.href,
            children: frame.children,
          });
        } else {
          // Unsafe or missing href: drop the link wrapper, keep its content.
          top().push(...frame.children);
        }
      } else {
        top().push({ kind: frame.kind, children: frame.children });
      }
    } else {
      // Stray closing tag: keep it as literal text.
      top().push({ kind: "text", value: raw });
    }
  }

  if (lastIndex < input.length) {
    top().push({ kind: "text", value: input.slice(lastIndex) });
  }

  // Unclosed tags degrade to literal text followed by their parsed children.
  while (stack.length > 0) {
    const frame = stack.pop()!;
    const parent = stack.length > 0 ? stack[stack.length - 1]!.children : root;
    parent.push({ kind: "text", value: frame.raw }, ...frame.children);
  }

  return root;
}

export interface RelatedTaskRef {
  id: string;
  title: string;
  status: string;
}

export function buildRelatedTasksByQaKey(
  tasks: TasksBoardData["tasks"],
): Record<string, RelatedTaskRef[]> {
  const out: Record<string, RelatedTaskRef[]> = {};
  for (const t of tasks) {
    if (!t.relatedQa) continue;
    const list = out[t.relatedQa] ?? [];
    list.push({ id: t.id, title: t.title, status: t.status });
    out[t.relatedQa] = list;
  }
  return out;
}

export interface QaSummary {
  summary: string;
  verdict: string;
}

export function buildQaSummaryByKey(
  qa: QaBoardData,
): Record<string, QaSummary> {
  const out: Record<string, QaSummary> = {};
  for (const t of qa.tests) {
    out[t.key] = {
      summary: t.summary,
      verdict: qa.verdictLabel[t.verdict] ?? t.verdict,
    };
  }
  return out;
}
