import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QaVerdict } from "@/types/internal-boards";

const STYLES: Record<QaVerdict, string> = {
  "PASS":         "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  "PARTIAL-FAIL": "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  "FAIL":         "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
  "BLOCKED":      "bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200",
  "IN-PROGRESS":  "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200",
  "NOT-RUN":      "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200",
  "SKIPPED":      "bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200",
  "UNKNOWN":      "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200",
};

export function VerdictBadge({
  verdict,
  label,
  className,
}: {
  verdict: QaVerdict;
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-semibold uppercase tracking-wide", STYLES[verdict], className)}>
      {label}
    </Badge>
  );
}
