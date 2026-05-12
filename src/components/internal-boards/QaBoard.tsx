import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TestTube2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerdictBadge } from "./VerdictBadge";
import type { QaBoardData, QaTest, QaVerdict } from "@/types/internal-boards";

const VERDICT_TONE: Record<QaVerdict, string> = {
  "PASS":         "text-emerald-700",
  "FAIL":         "text-rose-700",
  "PARTIAL-FAIL": "text-amber-700",
  "BLOCKED":      "text-purple-700",
  "IN-PROGRESS":  "text-sky-700",
  "NOT-RUN":      "text-slate-600",
  "SKIPPED":      "text-slate-500",
  "UNKNOWN":      "text-orange-700",
};

function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function QaBoard({
  data,
  relatedTasksByQaKey,
}: {
  data: QaBoardData;
  relatedTasksByQaKey: Record<string, { id: string; title: string; status: string }[]>;
}) {
  const byFolder = groupBy(data.tests, (t) => t.folder);
  const visibleVerdicts = data.verdictOrder.filter((v) => data.counts[v]);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50/50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <TestTube2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                QA Board
              </h1>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{data.source}</code>
                {" · "}{data.total} cases across {byFolder.size} folder{byFolder.size === 1 ? "" : "s"}
                {" · "}Generated {data.generated}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:gap-3">
            <StatPill label="Total" value={data.total} tone="amber" />
            {visibleVerdicts.map((v) => (
              <StatPill
                key={v}
                label={data.verdictLabel[v]}
                value={data.counts[v]}
                verdict={v}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
          {[...byFolder.entries()].map(([folder, tests]) => (
            <FolderSection
              key={folder}
              folder={folder}
              tests={tests}
              verdictLabel={data.verdictLabel}
              verdictOrder={data.verdictOrder}
              relatedTasksByQaKey={relatedTasksByQaKey}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
  verdict,
}: {
  label: string;
  value: number;
  tone?: "amber";
  verdict?: QaVerdict;
}) {
  const valueClass = tone === "amber"
    ? "text-amber-700"
    : verdict
    ? VERDICT_TONE[verdict]
    : "text-slate-700";

  return (
    <div className="flex shrink-0 items-baseline gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
      <span className={cn("font-semibold tabular-nums", valueClass)}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function FolderSection({
  folder,
  tests,
  verdictLabel,
  verdictOrder,
  relatedTasksByQaKey,
}: {
  folder: string;
  tests: QaTest[];
  verdictLabel: QaBoardData["verdictLabel"];
  verdictOrder: QaBoardData["verdictOrder"];
  relatedTasksByQaKey: Record<string, { id: string; title: string; status: string }[]>;
}) {
  const folderCounts: Partial<Record<QaVerdict, number>> = {};
  for (const t of tests) folderCounts[t.verdict] = (folderCounts[t.verdict] ?? 0) + 1;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <h2 className="mr-1 text-sm font-semibold uppercase tracking-wider text-slate-900">
          {folder}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
          {tests.length}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {verdictOrder
            .filter((v) => folderCounts[v])
            .map((v) => (
              <VerdictBadge
                key={v}
                verdict={v}
                label={`${folderCounts[v]} ${verdictLabel[v]}`}
                className="text-[10px]"
              />
            ))}
        </div>
      </header>

      <Accordion type="multiple" className="w-full">
        {tests.map((t) => (
          <TestRow
            key={t.key}
            test={t}
            verdictLabel={verdictLabel}
            relatedTasks={relatedTasksByQaKey[t.key]}
          />
        ))}
      </Accordion>
    </section>
  );
}

function TestRow({
  test,
  verdictLabel,
  relatedTasks,
}: {
  test: QaTest;
  verdictLabel: QaBoardData["verdictLabel"];
  relatedTasks?: { id: string; title: string; status: string }[];
}) {
  return (
    <AccordionItem value={test.key} className="border-b border-slate-100 last:border-b-0">
      <AccordionTrigger className="px-4 py-2.5 hover:bg-slate-50 hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-3 text-left sm:flex-row sm:items-center sm:gap-3">
          {/* Mobile-friendly top row: key + verdict + priority */}
          <div className="flex items-center gap-2 sm:contents">
            <code className="shrink-0 font-mono text-[11px] font-medium text-slate-500 sm:min-w-[110px]">
              {test.key}
            </code>
            <VerdictBadge
              verdict={test.verdict}
              label={verdictLabel[test.verdict]}
              className="shrink-0 text-[10px] sm:min-w-[80px] sm:justify-center"
            />
            {test.priority && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:min-w-[60px] sm:text-center",
                  test.priority === "High"
                    ? "bg-rose-50 text-rose-700 ring-rose-200"
                    : test.priority === "Medium"
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-slate-50 text-slate-600 ring-slate-200",
                )}
              >
                {test.priority}
              </span>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 sm:whitespace-normal sm:break-words">
            {test.summary}
          </span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-3 border-t border-slate-100 pt-3 sm:pl-[122px]">
          {test.description && (
            <p className="text-sm text-slate-600">{test.description}</p>
          )}

          {(test.labels.length > 0 || test.components.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {test.labels.map((l) => (
                <span
                  key={l}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                >
                  {l}
                </span>
              ))}
              {test.components.map((c) => (
                <span
                  key={c}
                  className="rounded bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] text-sky-700 ring-1 ring-inset ring-sky-200"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {relatedTasks && relatedTasks.length > 0 && (
            <div className="rounded-md bg-sky-50 px-3 py-2 ring-1 ring-sky-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-900">
                Tracked as task{relatedTasks.length > 1 ? "s" : ""}
              </div>
              <ul className="mt-1 space-y-0.5">
                {relatedTasks.map((rt) => (
                  <li key={rt.id} className="text-sm">
                    <Link
                      href="/admin/tasks-board"
                      className="inline-flex items-center gap-1 text-sky-800 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {rt.title}
                      <span className="text-xs text-sky-600">({rt.status})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {test.steps.length > 0 && (
            <>
              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-md border border-slate-200 sm:block">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-8 px-2 py-1.5 text-center font-medium">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Step</th>
                      <th className="px-2 py-1.5 text-left font-medium">Data</th>
                      <th className="px-2 py-1.5 text-left font-medium">Expected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {test.steps.map((s, i) => (
                      <tr key={i} className="align-top">
                        <td className="px-2 py-1.5 text-center text-slate-400">{i + 1}</td>
                        <td className="px-2 py-1.5">{s.step}</td>
                        <td className="break-all px-2 py-1.5 font-mono text-[11px] text-slate-700">
                          {s.data}
                        </td>
                        <td className="px-2 py-1.5">{s.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: stacked cards */}
              <ol className="space-y-2 sm:hidden">
                {test.steps.map((s, i) => (
                  <li key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                    <div className="mb-1 font-semibold text-slate-700">Step {i + 1}</div>
                    <div className="text-slate-700">{s.step}</div>
                    {s.data && (
                      <div className="mt-1 break-all font-mono text-[11px] text-slate-600">
                        <span className="font-sans text-slate-400">Data: </span>
                        {s.data}
                      </div>
                    )}
                    {s.expected && (
                      <div className="mt-1 text-slate-600">
                        <span className="text-slate-400">Expected: </span>
                        {s.expected}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          {test.notes && (
            <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                Notes
              </span>
              <p className="mt-1 text-slate-800">{test.notes}</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
