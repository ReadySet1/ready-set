"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  RotateCcw,
  CheckCircle,
  Clock,
  ChevronDown,
  X,
  Download,
  Users,
  Shield,
  User,
  Truck,
  Building2,
  Headphones,
  Mail,
} from "lucide-react";
import { UserStatus, UserType } from "@/types/prisma";

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onStatusChange: (status: UserStatus) => void;
  onRoleChange?: (role: UserType) => void;
  onDelete: () => void;
  onRestore?: () => void;
  onExport: () => void;
  onEmail?: () => void;
  isLoading?: boolean;
  mode: "active" | "deleted";
  isSuperAdmin?: boolean;
}

/**
 * Role configuration for dropdown display
 */
const roleConfig: Record<
  Exclude<UserType, "SUPER_ADMIN">,
  { label: string; icon: React.ReactNode; className: string }
> = {
  VENDOR: {
    label: "Vendor",
    icon: <Building2 className="h-4 w-4" />,
    className: "text-purple-600",
  },
  CLIENT: {
    label: "Client",
    icon: <User className="h-4 w-4" />,
    className: "text-blue-600",
  },
  DRIVER: {
    label: "Driver",
    icon: <Truck className="h-4 w-4" />,
    className: "text-green-600",
  },
  ADMIN: {
    label: "Admin",
    icon: <Shield className="h-4 w-4" />,
    className: "text-yellow-600",
  },
  HELPDESK: {
    label: "Helpdesk",
    icon: <Headphones className="h-4 w-4" />,
    className: "text-orange-600",
  },
};

/**
 * Floating action bar that appears when users are selected
 * Shows count and provides bulk action buttons
 */
export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onStatusChange,
  onRoleChange,
  onDelete,
  onRestore,
  onExport,
  onEmail,
  isLoading = false,
  mode,
  isSuperAdmin = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      >
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
          {/* Selection count */}
          <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
              <Users className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">
              {selectedCount} {selectedCount === 1 ? "user" : "users"} selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {mode === "active" ? (
              <>
                {/* Status dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      className="flex items-center gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Status
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      onClick={() => onStatusChange(UserStatus.ACTIVE)}
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                      Set Active
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onStatusChange(UserStatus.PENDING)}
                    >
                      <Clock className="mr-2 h-4 w-4 text-amber-600" />
                      Set Pending
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Role dropdown - SUPER_ADMIN only */}
                {isSuperAdmin && onRoleChange && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        className="flex items-center gap-1"
                      >
                        <Shield className="h-4 w-4" />
                        Role
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(Object.keys(roleConfig) as Array<Exclude<UserType, "SUPER_ADMIN">>).map(
                        (role) => {
                          const config = roleConfig[role];
                          return (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => onRoleChange(role)}
                              className={config.className}
                            >
                              <span className="mr-2">{config.icon}</span>
                              Set as {config.label}
                            </DropdownMenuItem>
                          );
                        }
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Delete button */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={onDelete}
                  className="flex items-center gap-1 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </>
            ) : (
              /* Restore button for deleted users */
              onRestore && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={onRestore}
                  className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore
                </Button>
              )
            )}

            {/* Email button */}
            {mode === "active" && onEmail && (
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={onEmail}
                className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
            )}

            {/* Export button */}
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={onExport}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>

            <DropdownMenuSeparator className="h-6" />

            {/* Clear selection button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isLoading}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span className="text-sm text-slate-500">Processing...</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
