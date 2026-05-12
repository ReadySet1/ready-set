import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

export type DescriptionSegment =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string };

const CODE_PATTERN = /<code>([\s\S]*?)<\/code>/g;

export function parseDescription(input: string | undefined): DescriptionSegment[] {
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
