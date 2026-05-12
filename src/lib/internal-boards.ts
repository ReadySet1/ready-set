import type { QaBoardData, TasksBoardData } from "@/types/internal-boards";

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
