import Link from "next/link";
import { Kanban, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDescription } from "@/lib/internal-boards";
import type { TasksBoardData, TasksBoardTask } from "@/types/internal-boards";

const STATUS_STYLES: Record<
  TasksBoardTask["status"],
  { bar: string; header: string; dot: string; columnBg: string }
> = {
  done: {
    bar:      "border-l-emerald-500",
    header:   "text-emerald-700",
    dot:      "bg-emerald-500",
    columnBg: "bg-emerald-50/40",
  },
  progress: {
    bar:      "border-l-amber-500",
    header:   "text-amber-700",
    dot:      "bg-amber-500",
    columnBg: "bg-amber-50/40",
  },
  open: {
    bar:      "border-l-rose-500",
    header:   "text-rose-700",
    dot:      "bg-rose-500",
    columnBg: "bg-rose-50/40",
  },
  new: {
    bar:      "border-l-sky-500",
    header:   "text-sky-700",
    dot:      "bg-sky-500",
    columnBg: "bg-sky-50/40",
  },
};

const OWNER_COLORS: Record<string, { bg: string; text: string }> = {
  emmanuel: { bg: "bg-blue-500",    text: "text-blue-700" },
  gary:     { bg: "bg-purple-500",  text: "text-purple-700" },
  fernando: { bg: "bg-emerald-500", text: "text-emerald-700" },
};

const TAG_STYLES: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700 ring-rose-200",
  moot:     "bg-slate-100 text-slate-600 ring-slate-200",
  bug:      "bg-rose-100 text-rose-700 ring-rose-200",
};

const TAG_LABEL: Record<string, string> = {
  critical: "critical path",
  moot:     "likely moot",
  bug:      "bug",
};

export function TasksBoard({
  data,
  qaSummaryByKey,
}: {
  data: TasksBoardData;
  qaSummaryByKey: Record<string, { summary: string; verdict: string }>;
}) {
  const byStatus = new Map<TasksBoardTask["status"], TasksBoardTask[]>();
  for (const col of data.columns) byStatus.set(col.key, []);
  for (const task of data.tasks) byStatus.get(task.status)?.push(task);

  const counts = {
    done:     byStatus.get("done")?.length     ?? 0,
    progress: byStatus.get("progress")?.length ?? 0,
    open:     byStatus.get("open")?.length     ?? 0,
    new:      byStatus.get("new")?.length      ?? 0,
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50/50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Kanban className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                Tasks Board
              </h1>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
                {data.subtitle}
              </p>
            </div>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:gap-3">
            <StatPill label="Total"        value={data.tasks.length} tone="amber" />
            <StatPill label="Done"         value={counts.done}       tone="emerald" />
            <StatPill label="In Progress"  value={counts.progress}   tone="amber" />
            <StatPill label="Open"         value={counts.open}       tone="rose" />
            <StatPill label="New"          value={counts.new}        tone="sky" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex gap-4 overflow-x-auto pb-4">
            {data.columns.map((col) => (
              <Column
                key={col.key}
                title={col.title}
                status={col.key}
                tasks={byStatus.get(col.key) ?? []}
                owners={data.owners}
                sourceLabels={data.sourceLabels}
                qaSummaryByKey={qaSummaryByKey}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Source: <code className="rounded bg-slate-100 px-1.5 py-0.5">meetings/shared/tasks-board.json</code>
            {" · "}Generated {data.generated}
          </p>
        </div>
      </main>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald" | "rose" | "sky";
}) {
  const toneClass = {
    amber:   "text-amber-700",
    emerald: "text-emerald-700",
    rose:    "text-rose-700",
    sky:     "text-sky-700",
  }[tone];
  return (
    <div className="flex shrink-0 items-baseline gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
      <span className={cn("font-semibold tabular-nums", toneClass)}>{value}</span>
      <span className="text-slate-600">{label}</span>
    </div>
  );
}

function Column({
  title,
  status,
  tasks,
  owners,
  sourceLabels,
  qaSummaryByKey,
}: {
  title: string;
  status: TasksBoardTask["status"];
  tasks: TasksBoardTask[];
  owners: Record<string, string>;
  sourceLabels: Record<string, string>;
  qaSummaryByKey: Record<string, { summary: string; verdict: string }>;
}) {
  const styles = STATUS_STYLES[status];
  return (
    <section
      className={cn(
        "flex w-[320px] shrink-0 flex-col rounded-lg border border-slate-200",
        styles.columnBg,
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white/60 px-3 py-2.5">
        <h2 className={cn("text-xs font-semibold uppercase tracking-wider", styles.header)}>
          {title}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2 p-2.5">
        {tasks.length === 0 ? (
          <p className="px-1 py-3 text-center text-xs text-slate-400">No tasks</p>
        ) : (
          tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              barClass={styles.bar}
              owners={owners}
              sourceLabels={sourceLabels}
              qaSummaryByKey={qaSummaryByKey}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  barClass,
  owners,
  sourceLabels,
  qaSummaryByKey,
}: {
  task: TasksBoardTask;
  barClass: string;
  owners: Record<string, string>;
  sourceLabels: Record<string, string>;
  qaSummaryByKey: Record<string, { summary: string; verdict: string }>;
}) {
  const sourceText = task.sourceRef
    ? `${sourceLabels[task.source] ?? task.source} ${task.sourceRef}`
    : (sourceLabels[task.source] ?? task.source);
  const linkedQa = task.relatedQa ? qaSummaryByKey[task.relatedQa] : undefined;
  const ownerColor = OWNER_COLORS[task.owner];
  const ownerLabel = owners[task.owner] ?? task.owner;
  const ownerInitial = ownerLabel.charAt(0).toUpperCase();

  return (
    <article
      className={cn(
        "group rounded-md border border-slate-200 border-l-4 bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md",
        barClass,
      )}
    >
      <h3
        className="mb-1.5 text-[13px] font-semibold leading-snug text-slate-900"
        title={task.title}
      >
        {task.title}
      </h3>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
          {sourceText}
        </span>
        <span
          title={ownerLabel}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white",
            ownerColor?.bg ?? "bg-slate-400",
          )}
        >
          {ownerInitial}
        </span>
        <span className={cn("text-[10px] font-medium", ownerColor?.text ?? "text-slate-600")}>
          {ownerLabel}
        </span>
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              TAG_STYLES[tag] ?? "bg-slate-100 text-slate-600 ring-slate-200",
            )}
          >
            {TAG_LABEL[tag] ?? tag}
          </span>
        ))}
      </div>

      {task.description && (
        <p className="text-[12px] leading-relaxed text-slate-600">
          {parseDescription(task.description).map((seg, i) =>
            seg.kind === "code" ? (
              <code
                key={i}
                className="break-all rounded bg-slate-100 px-1 py-0.5 font-mono text-[10.5px] text-slate-700"
              >
                {seg.value}
              </code>
            ) : (
              <span key={i}>{seg.value}</span>
            ),
          )}
        </p>
      )}

      {linkedQa && (
        <Link
          href="/admin/qa-board"
          className="mt-2 inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
        >
          <ExternalLink className="h-3 w-3" />
          From QA: {task.relatedQa}
          <span className="text-sky-500">— {linkedQa.verdict}</span>
        </Link>
      )}
    </article>
  );
}
