"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AuditLogEntry,
  AUDIT_ACTION_COLORS,
  AUDIT_ACTION_LABELS,
} from "@/types/audit";
import { DiffViewer } from "./DiffViewer";

interface AuditLogItemProps {
  log: AuditLogEntry;
  className?: string;
}

/**
 * Format a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a time for display
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get initials from a name
 */
function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * A single audit log entry with expandable details
 */
export function AuditLogItem({ log, className }: AuditLogItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const actionColors = AUDIT_ACTION_COLORS[log.action];
  const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action;

  const hasDetails = log.changes || log.reason;

  return (
    <div
      className={cn(
        "border rounded-lg bg-white shadow-sm overflow-hidden",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className={cn(
            "w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors",
            hasDetails && "cursor-pointer"
          )}
          disabled={!hasDetails}
        >
          {/* Avatar */}
          <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
            <AvatarImage
              src={log.performerImage || undefined}
              alt={log.performerName || "User"}
            />
            <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
              {getInitials(log.performerName)}
            </AvatarFallback>
          </Avatar>

          {/* Main content */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">
                {log.performerName || log.performerEmail || "System"}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-normal",
                  actionColors.bg,
                  actionColors.text,
                  actionColors.border
                )}
              >
                {actionLabel}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
              <span>{formatDate(log.createdAt)}</span>
              <span>•</span>
              <span>{formatTime(log.createdAt)}</span>
              {log.performerEmail && log.performerName && (
                <>
                  <span>•</span>
                  <span className="truncate">{log.performerEmail}</span>
                </>
              )}
            </div>

            {/* Brief summary for collapsed state */}
            {!isOpen && log.reason && (
              <p className="text-sm text-gray-600 mt-1 truncate">
                {log.reason}
              </p>
            )}
          </div>

          {/* Expand indicator */}
          {hasDetails && (
            <div className="flex-shrink-0 text-gray-400">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          )}
        </CollapsibleTrigger>

        {hasDetails && (
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
              {log.reason && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Reason
                  </span>
                  <p className="text-sm text-gray-700 mt-1">{log.reason}</p>
                </div>
              )}

              {log.changes && (
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                    Changes
                  </span>
                  <DiffViewer changes={log.changes} />
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export default AuditLogItem;
