"use client";

import { Fragment, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { LayoutGrid, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseRichDescription, type RichSegment } from "@/lib/internal-boards";
import type {
  TaskStatus,
  TasksBoardData,
  TasksBoardTask,
} from "@/types/internal-boards";

// ─── Design constants (design_handoff_tasks_board/README.md) ────────────────

const STATUS_META: Record<
  TaskStatus,
  { statLabel: string; dot: string; pill: string; pillDot: string }
> = {
  done: {
    statLabel: "Done",
    dot: "bg-green-500",
    pill: "bg-green-100 text-green-700",
    pillDot: "bg-green-500",
  },
  progress: {
    statLabel: "In Progress",
    dot: "bg-blue-500",
    pill: "bg-blue-100 text-blue-700",
    pillDot: "bg-blue-500",
  },
  open: {
    statLabel: "Open",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700",
    pillDot: "bg-amber-500",
  },
  new: {
    statLabel: "New",
    dot: "bg-brand",
    pill: "bg-yellow-100 text-brand-deep",
    pillDot: "bg-brand",
  },
};

const OWNER_STYLES: Record<string, string> = {
  emmanuel: "bg-charcoal text-white",
  fernando: "bg-yellow-400 text-charcoal",
  gary: "bg-slate-200 text-slate-700",
  mai: "bg-blue-100 text-blue-700",
};

const TAG_META: Record<string, { label: string; pill: string }> = {
  bug: { label: "bug", pill: "bg-red-100 text-red-700" },
  critical: { label: "critical path", pill: "bg-amber-100 text-amber-700" },
  moot: { label: "likely moot", pill: "bg-slate-100 text-slate-500" },
};

interface FilterDef {
  key: string;
  label: string;
  matches: (task: TasksBoardTask) => boolean;
  activeClass: string;
}

const FILTERS: FilterDef[] = [
  {
    key: "bug",
    label: "bug",
    matches: (t) => t.tags?.includes("bug") ?? false,
    activeClass: "border-red-700 bg-red-100 text-red-700",
  },
  {
    key: "critical",
    label: "critical path",
    matches: (t) => t.tags?.includes("critical") ?? false,
    activeClass: "border-amber-700 bg-amber-100 text-amber-700",
  },
  {
    key: "moot",
    label: "likely moot",
    matches: (t) => t.tags?.includes("moot") ?? false,
    activeClass: "border-slate-500 bg-slate-100 text-slate-500",
  },
  {
    key: "catercow",
    label: "CaterCow",
    matches: (t) => t.source === "catercow",
    activeClass: "border-blue-700 bg-blue-100 text-blue-700",
  },
  {
    key: "qa",
    label: "QA",
    matches: (t) => t.source === "qa",
    activeClass: "border-slate-600 bg-slate-100 text-slate-600",
  },
];

// The panel keeps a static translateX(-50%) for horizontal centering, so the
// pop-in keyframes must carry it through the animation as well.
const MODAL_POP_KEYFRAMES = `@keyframes rs-tasks-pop { from { opacity: 0; transform: translate(-50%, 8px) scale(.985); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** The generated column titles carry leading glyphs (✓ ◐ ○ ★); the dot replaces them. */
function cleanColumnTitle(title: string): string {
  return title.replace(/^[✓◐○★]\s*/u, "");
}

/** Card/modal meta text: "#10 · May 4", or just the source label without a ref. */
function metaText(
  task: TasksBoardTask,
  sourceLabels: Record<string, string>,
): string {
  const label = sourceLabels[task.source] ?? task.source;
  return task.sourceRef ? `${task.sourceRef} · ${label}` : label;
}

function ownerAvatarClass(owner: string): string {
  return OWNER_STYLES[owner] ?? "bg-slate-400 text-white";
}

// ─── Sanitized rich-text renderer (segments from parseRichDescription) ──────

function RichText({ segments }: { segments: RichSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case "text":
            return <Fragment key={i}>{seg.value}</Fragment>;
          case "br":
            return <br key={i} />;
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-700"
              >
                <RichText segments={seg.children} />
              </code>
            );
          case "em":
            return (
              <em key={i}>
                <RichText segments={seg.children} />
              </em>
            );
          case "strong":
            return (
              <strong key={i} className="font-semibold text-slate-700">
                <RichText segments={seg.children} />
              </strong>
            );
          case "link":
            return (
              <a
                key={i}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
              >
                <RichText segments={seg.children} />
              </a>
            );
        }
      })}
    </>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

export function TasksBoard({
  data,
  qaSummaryByKey,
}: {
  data: TasksBoardData;
  qaSummaryByKey: Record<string, { summary: string; verdict: string }>;
}) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const activeSet = new Set(activeFilters);
  const isVisible = (task: TasksBoardTask) =>
    activeFilters.length === 0 ||
    FILTERS.some((f) => activeSet.has(f.key) && f.matches(task));

  // Header stat chips always show totals; column counts follow the filter.
  const totals = new Map<TaskStatus, number>();
  const visibleByStatus = new Map<TaskStatus, TasksBoardTask[]>();
  for (const col of data.columns) {
    totals.set(col.key, 0);
    visibleByStatus.set(col.key, []);
  }
  for (const task of data.tasks) {
    totals.set(task.status, (totals.get(task.status) ?? 0) + 1);
    if (isVisible(task)) visibleByStatus.get(task.status)?.push(task);
  }

  const toggleFilter = (key: string) =>
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const openTask = openTaskId
    ? (data.tasks.find((t) => t.id === openTaskId) ?? null)
    : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-subtle">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/[.88] px-7 pt-[22px] backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center self-center rounded-[10px] bg-brand">
              <LayoutGrid
                className="h-[18px] w-[18px] text-charcoal"
                strokeWidth={2}
              />
            </div>
            <h1 className="font-display text-[26px] font-bold tracking-[.01em] text-text-primary">
              Tasks Board
            </h1>
          </div>
          <span className="text-[13px] text-slate-500">{data.subtitle}</span>
          <div className="ml-auto flex flex-wrap items-center gap-3.5">
            <StatChip
              dotClass="bg-slate-400"
              label={`${data.tasks.length} Total`}
            />
            {data.columns.map((col) => (
              <StatChip
                key={col.key}
                dotClass={STATUS_META[col.key].dot}
                label={`${totals.get(col.key) ?? 0} ${STATUS_META[col.key].statLabel}`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-4 pt-3.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-slate-400">
            Filter
          </span>
          {FILTERS.map((filter) => {
            const active = activeSet.has(filter.key);
            const count = data.tasks.filter(filter.matches).length;
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFilter(filter.key)}
                className={cn(
                  "h-[30px] rounded-full border px-3.5 text-[12px] font-bold transition-all duration-150",
                  active
                    ? filter.activeClass
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                {filter.label} · {count}
              </button>
            );
          })}
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters([])}
              className="h-[30px] px-3 text-[12px] font-semibold text-slate-500 underline"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-[12px] text-slate-400">
            Click a card for full notes
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-start gap-4 overflow-x-auto px-7 pb-2 pt-5">
        {data.columns.map((col) => {
          const tasks = visibleByStatus.get(col.key) ?? [];
          return (
            <section
              key={col.key}
              className="flex max-h-[calc(100vh-170px)] min-w-[280px] flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-100"
            >
              <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
                <span
                  className={cn(
                    "h-[9px] w-[9px] rounded-full",
                    STATUS_META[col.key].dot,
                  )}
                />
                <h2 className="text-[12px] font-extrabold uppercase tracking-[.07em] text-slate-700">
                  {cleanColumnTitle(col.title)}
                </h2>
                <span className="ml-auto min-w-[26px] rounded-full border border-slate-200 bg-white px-2 py-0.5 text-center text-[11.5px] font-bold tabular-nums text-slate-500">
                  {tasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto px-2.5 pb-3 pt-1">
                {tasks.length === 0 ? (
                  <div className="rounded-xl border-[1.5px] border-dashed border-slate-300 px-3 py-[18px] text-center text-[12px] text-slate-400">
                    No matching tasks
                  </div>
                ) : (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      owners={data.owners}
                      sourceLabels={data.sourceLabels}
                      onOpen={() => setOpenTaskId(task.id)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="px-7 pb-[18px] pt-2.5 text-[11.5px] text-slate-400">
        Source: meetings/shared/tasks-board.json · Generated {data.generated}
      </footer>

      {openTask && (
        <TaskModal
          task={openTask}
          columns={data.columns}
          owners={data.owners}
          sourceLabels={data.sourceLabels}
          qaSummaryByKey={qaSummaryByKey}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}

function StatChip({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  owners,
  sourceLabels,
  onOpen,
}: {
  task: TasksBoardTask;
  owners: Record<string, string>;
  sourceLabels: Record<string, string>;
  onOpen: () => void;
}) {
  const ownerName = owners[task.owner] ?? task.owner;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-[7px] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-md"
    >
      <span className="text-[13px] font-semibold leading-[1.35] text-text-primary">
        {task.title}
      </span>
      {task.description && (
        <span className="line-clamp-2 break-words text-[12px] leading-[1.45] text-slate-500">
          <RichText segments={parseRichDescription(task.description)} />
        </span>
      )}
      <span className="flex flex-wrap items-center gap-[5px]">
        {task.tags?.map((tag) => (
          <span
            key={tag}
            className={cn(
              "whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold",
              TAG_META[tag]?.pill ?? "bg-slate-100 text-slate-600",
            )}
          >
            {TAG_META[tag]?.label ?? tag}
          </span>
        ))}
        <span className="ml-auto whitespace-nowrap text-[11px] font-semibold text-slate-400">
          {metaText(task, sourceLabels)}
        </span>
        <span
          title={ownerName}
          className={cn(
            "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold",
            ownerAvatarClass(task.owner),
          )}
        >
          {ownerName.charAt(0).toUpperCase()}
        </span>
      </span>
    </button>
  );
}

// ─── Detail modal ────────────────────────────────────────────────────────────

function TaskModal({
  task,
  columns,
  owners,
  sourceLabels,
  qaSummaryByKey,
  onClose,
}: {
  task: TasksBoardTask;
  columns: TasksBoardData["columns"];
  owners: Record<string, string>;
  sourceLabels: Record<string, string>;
  qaSummaryByKey: Record<string, { summary: string; verdict: string }>;
  onClose: () => void;
}) {
  const status = STATUS_META[task.status];
  const column = columns.find((c) => c.key === task.status);
  const statusLabel = column
    ? cleanColumnTitle(column.title)
    : status.statLabel;
  const ownerName = owners[task.owner] ?? task.owner;
  const qaVerdict = task.relatedQa
    ? qaSummaryByKey[task.relatedQa]?.verdict
    : undefined;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <style>{MODAL_POP_KEYFRAMES}</style>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[6vh] z-50 max-h-[84vh] w-[calc(100vw-48px)] max-w-[680px] -translate-x-1/2 overflow-y-auto rounded-2xl bg-white shadow-xl focus:outline-none"
          style={{
            animation: "rs-tasks-pop .25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div className="flex items-center gap-2.5 px-[22px] pt-[18px]">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[12px] font-bold",
                status.pill,
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", status.pillDot)}
              />
              {statusLabel}
            </span>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                title="Close"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="h-[15px] w-[15px]" strokeWidth={2} />
              </button>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Title asChild>
            <h2 className="mt-3 px-[22px] text-[19px] font-extrabold leading-[1.3] text-text-primary">
              {task.title}
            </h2>
          </DialogPrimitive.Title>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-[22px]">
            <span className="inline-flex items-center gap-[7px] rounded-full bg-slate-100 py-[3px] pl-1 pr-2.5 text-[12px] font-semibold text-slate-700">
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold",
                  ownerAvatarClass(task.owner),
                )}
              >
                {ownerName.charAt(0).toUpperCase()}
              </span>
              {ownerName}
            </span>
            {task.tags?.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded-full px-2.5 py-[3px] text-[11px] font-bold",
                  TAG_META[tag]?.pill ?? "bg-slate-100 text-slate-600",
                )}
              >
                {TAG_META[tag]?.label ?? tag}
              </span>
            ))}
            <span className="ml-auto text-[12px] font-semibold text-slate-400">
              {metaText(task, sourceLabels)}
            </span>
          </div>

          {task.description && (
            <div className="px-[22px] pb-1 pt-1.5">
              <p className="mt-3 break-words text-[13.5px] leading-[1.65] text-slate-600">
                <RichText segments={parseRichDescription(task.description)} />
              </p>
            </div>
          )}

          {task.relatedQa && (
            <Link
              href="/admin/qa-board"
              className="mx-[22px] mt-4 block rounded-[10px] bg-red-100 px-3.5 py-2.5 text-[12.5px] font-semibold text-red-700 transition-colors duration-150 hover:bg-red-200/70"
            >
              From QA: {task.relatedQa}
              {qaVerdict ? ` — ${qaVerdict}` : ""}
            </Link>
          )}

          <div className="px-[22px] pb-5 pt-4 text-[11.5px] text-slate-400">
            Esc or click outside to close
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
