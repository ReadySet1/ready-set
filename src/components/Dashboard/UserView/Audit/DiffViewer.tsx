"use client";

import { cn } from "@/lib/utils";
import { FieldChange, parseChanges, AuditChanges } from "@/types/audit";

interface DiffViewerProps {
  changes: AuditChanges | null;
  className?: string;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "—";
    }
    return JSON.stringify(value);
  }
  const strValue = String(value);
  return strValue.length > 0 ? strValue : "—";
}

/**
 * Get the appropriate color classes for a change type
 */
function getChangeTypeStyles(type: FieldChange["type"]) {
  switch (type) {
    case "added":
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        label: "text-green-700",
        badge: "bg-green-100 text-green-700",
      };
    case "removed":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        label: "text-red-700",
        badge: "bg-red-100 text-red-700",
      };
    case "modified":
    default:
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        label: "text-blue-700",
        badge: "bg-blue-100 text-blue-700",
      };
  }
}

/**
 * Single field change row
 */
function FieldChangeRow({ change }: { change: FieldChange }) {
  const styles = getChangeTypeStyles(change.type);

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        styles.bg,
        styles.border
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-gray-700">
          {change.label}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
            styles.badge
          )}
        >
          {change.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {change.type !== "added" && (
          <div>
            <span className="text-xs text-gray-500 block mb-1">Before</span>
            <span className="text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 block break-words">
              {formatValue(change.before)}
            </span>
          </div>
        )}
        {change.type !== "removed" && (
          <div className={change.type === "added" ? "col-span-2" : ""}>
            <span className="text-xs text-gray-500 block mb-1">After</span>
            <span className="text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 block break-words">
              {formatValue(change.after)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Component to display before/after changes in a diff format
 */
export function DiffViewer({ changes, className }: DiffViewerProps) {
  if (!changes) {
    return (
      <div className={cn("text-sm text-gray-500 italic", className)}>
        No change details available
      </div>
    );
  }

  const fieldChanges = parseChanges(changes);

  if (fieldChanges.length === 0) {
    return (
      <div className={cn("text-sm text-gray-500 italic", className)}>
        No field changes recorded
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {fieldChanges.map((change, index) => (
        <FieldChangeRow key={`${change.field}-${index}`} change={change} />
      ))}
    </div>
  );
}

export default DiffViewer;
