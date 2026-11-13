import { Archive, ExternalLink } from "lucide-react";

/** Slack list that replaced this board as the source of truth on 2026-11-05. */
export const DEV_TEAM_PENDINGS_URL =
  "https://readysetgrouphq.slack.com/lists/T020J0P09D1/F0CF98B1TS6";

/**
 * Banner shown above the Tasks Board: the board is a frozen archive and
 * pending work is tracked in Slack.
 */
export function ArchivedBoardNotice() {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-7 py-2.5 text-[13px] text-amber-900"
    >
      <Archive className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span>
        This board was archived on Nov 5, 2026 and is no longer updated. Pending
        work now lives in Slack.
      </span>
      <a
        href={DEV_TEAM_PENDINGS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
      >
        Open Dev Team Pendings
        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </a>
    </div>
  );
}
