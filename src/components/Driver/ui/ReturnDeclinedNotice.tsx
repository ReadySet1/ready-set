"use client";

import * as React from "react";
import { Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** localStorage key: JSON array of dismissed return-request ids. */
export const RETURN_DECLINED_DISMISSED_KEY = "rs-driver:return-declined-dismissed";
/** Keep the dismissed list bounded — a driver never has this many live rejections. */
const MAX_REMEMBERED = 20;

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(RETURN_DECLINED_DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(requestId: string) {
  try {
    const next = [requestId, ...readDismissed().filter((id) => id !== requestId)].slice(
      0,
      MAX_REMEMBERED,
    );
    window.localStorage.setItem(RETURN_DECLINED_DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked (private mode) — the notice still hides for this mount */
  }
}

interface ReturnDeclinedNoticeProps {
  /** The REJECTED request id — dismissal is remembered per request. */
  requestId: string;
  /** Helpdesk's resolution notes, shown verbatim when present. */
  notes?: string | null;
  className?: string;
}

/**
 * Dismissable notice that dispatch declined the driver's return request and
 * the delivery is still theirs. Dismissal is client-side per request id
 * (localStorage, best-effort) so the notice never nags across reloads, but a
 * later rejection with a new id shows again.
 */
export function ReturnDeclinedNotice({
  requestId,
  notes,
  className,
}: ReturnDeclinedNoticeProps) {
  const [dismissed, setDismissed] = React.useState(() =>
    readDismissed().includes(requestId),
  );

  if (dismissed) return null;

  const trimmedNotes = notes?.trim();

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-driver-warning/30 bg-driver-warning-bg px-3 py-2.5",
        className,
      )}
    >
      <Undo2
        className="mt-0.5 h-4 w-4 shrink-0 text-driver-warning-ink"
        strokeWidth={2.4}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-[13px] font-semibold text-driver-warning-ink">
          Dispatch declined your return request
        </div>
        <div className="text-[12.5px] font-medium leading-snug text-driver-muted">
          This delivery is still yours to complete.
        </div>
        {trimmedNotes ? (
          <div className="mt-1 text-[12.5px] font-medium leading-snug text-driver-text">
            <span className="font-semibold">Note from dispatch:</span> {trimmedNotes}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          rememberDismissed(requestId);
          setDismissed(true);
        }}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-driver-subtle transition-colors hover:bg-driver-surface-alt hover:text-driver-text"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
