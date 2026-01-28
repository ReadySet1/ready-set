"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Users2,
  AlertCircle,
  Search,
  ChevronDown,
  Calendar,
  User,
  PlusCircle,
  Filter,
  Mail,
  Phone,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Eye,
  EyeOff,
  History,
  ShieldAlert,
  Minus,
  Upload,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection, getSelectedIdsArray } from "@/hooks/useBulkSelection";
import { useBulkUserOperations } from "@/hooks/useBulkUserOperations";
import { BulkActionBar } from "@/components/Admin/users/BulkActionBar";
import { BulkConfirmDialog } from "@/components/Admin/users/BulkConfirmDialog";
import { BulkImportDialog } from "@/components/Admin/users/BulkImportDialog";
import { BulkEmailDialog } from "@/components/Admin/users/BulkEmailDialog";
import type { BulkOperationType } from "@/types/bulk-operations";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { UserType, UserStatus } from "@/types/prisma-enums";
import { logger } from "@/utils/logger";
import {
  ApiTypeUtils,
  ApiUserTypeFilter,
  ApiUserStatusFilter,
  UsersApiResponse,
} from "@/types/api-shared";

// --- Updated Types using shared definitions ---
interface User {
  id: string;
  name?: string | null;
  email: string | null;
  type: UserType; // Now uses uppercase enum values
  contact_name?: string | null;
  contact_number?: string | null;
  companyName?: string | null;
  status: UserStatus; // Now uses uppercase enum values
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletionReason?: string | null;
}

interface DeletedUser extends User {
  deletedAt: string;
  deletedBy: string;
  deletionReason?: string | null;
  deletedByUser?: {
    name?: string | null;
    email: string;
  };
}

// --- Status and Type Configuration using uppercase enum values ---
const userTypeConfig: Record<
  UserType,
  { className: string; icon: React.ReactNode }
> = {
  VENDOR: {
    className: "bg-purple-100 text-purple-800 hover:bg-purple-200",
    icon: <User className="h-3 w-3" />,
  },
  CLIENT: {
    className: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    icon: <User className="h-3 w-3" />,
  },
  DRIVER: {
    className: "bg-green-100 text-green-800 hover:bg-green-200",
    icon: <User className="h-3 w-3" />,
  },
  ADMIN: {
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
    icon: <User className="h-3 w-3" />,
  },
  HELPDESK: {
    className: "bg-orange-100 text-orange-800 hover:bg-orange-200",
    icon: <User className="h-3 w-3" />,
  },
  SUPER_ADMIN: {
    className: "bg-red-100 text-red-800 hover:bg-red-200",
    icon: <User className="h-3 w-3" />,
  },
};

const statusConfig: Record<
  UserStatus,
  { className: string; icon: React.ReactNode }
> = {
  ACTIVE: {
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  PENDING: {
    className: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  DELETED: {
    className: "bg-red-100 text-red-800 hover:bg-red-200",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

// --- Loading Skeleton ---
const LoadingSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-10 w-[250px]" />
      <Skeleton className="h-10 w-[200px]" />
    </div>
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-slate-50 p-4">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-t p-4">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, j) => (
              <Skeleton
                key={j}
                className="h-6 w-full"
                style={{ animationDelay: `${i * 100 + j * 50}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="flex justify-center">
      <Skeleton className="h-10 w-[300px]" />
    </div>
  </div>
);

const ITEMS_PER_PAGE = 10;

// Export the client component directly
interface UsersClientProps {
  userType: string;
}

const UsersClient: React.FC<UsersClientProps> = ({ userType }) => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");
  const [users, setUsers] = useState<User[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ApiUserStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<ApiUserTypeFilter>("all");
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Delete/Restore related state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");

  // Restore related state
  const [userToRestore, setUserToRestore] = useState<DeletedUser | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Permanent delete related state
  const [userToPermanentlyDelete, setUserToPermanentlyDelete] =
    useState<DeletedUser | null>(null);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] =
    useState(false);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [permanentDeletionReason, setPermanentDeletionReason] = useState("");

  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  // Check if current user can delete users (using uppercase values)
  const normalizedUserType = ApiTypeUtils.normalizeUserType(userType);
  const canDeleteUsers =
    normalizedUserType === "ADMIN" || normalizedUserType === "SUPER_ADMIN";
  const canPermanentlyDelete = normalizedUserType === "SUPER_ADMIN";

  // Bulk selection state - memoize page IDs based on current tab
  const pageUserIds = useMemo(() => {
    if (activeTab === "active") {
      return users.filter(u => u.type !== "SUPER_ADMIN").map(u => u.id);
    }
    return deletedUsers.map(u => u.id);
  }, [activeTab, users, deletedUsers]);

  const {
    selectedIds,
    selectedCount,
    isAllOnPageSelected,
    toggle: toggleSelection,
    selectAll,
    deselectAll,
    clearAll: clearSelection,
    isSelected,
    selectAllMatching,
    isSelectAllMatchingMode,
    matchingCount,
    exitSelectAllMatchingMode,
  } = useBulkSelection(pageUserIds);

  // State for fetching all matching IDs
  const [isLoadingMatchingIds, setIsLoadingMatchingIds] = useState(false);
  const [matchingIdsCount, setMatchingIdsCount] = useState<number | null>(null);

  // Bulk operations dialog state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkOperationType, setBulkOperationType] = useState<BulkOperationType>("soft_delete");
  const [bulkTargetStatus, setBulkTargetStatus] = useState<UserStatus | undefined>();
  const [bulkTargetRole, setBulkTargetRole] = useState<UserType | undefined>();

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Email dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);

  // Check if current user is SUPER_ADMIN
  const isSuperAdmin = normalizedUserType === "SUPER_ADMIN";

  // Bulk operations mutations
  const {
    bulkStatusChangeMutation,
    bulkRoleChangeMutation,
    bulkDeleteMutation,
    bulkRestoreMutation,
    bulkExportMutation,
    isAnyLoading: isBulkLoading,
  } = useBulkUserOperations({
    onStatusChangeSuccess: (data) => {
      toast({
        title: "Status changed",
        description: `${data.results.totalSuccess} users updated successfully.`,
        duration: 3000,
      });
      clearSelection();
    },
    onStatusChangeError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
    onRoleChangeSuccess: (data) => {
      toast({
        title: "Role changed",
        description: `${data.results.totalSuccess} users updated successfully.`,
        duration: 3000,
      });
      clearSelection();
      // Refresh data
      setSearchTerm(prev => prev);
    },
    onRoleChangeError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
    onDeleteSuccess: (data) => {
      toast({
        title: "Users deleted",
        description: `${data.results.totalSuccess} users moved to trash.`,
        duration: 3000,
      });
      clearSelection();
      // Refresh data - trigger re-fetch
      setSearchTerm(prev => prev);
    },
    onDeleteError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
    onRestoreSuccess: (data) => {
      toast({
        title: "Users restored",
        description: `${data.results.totalSuccess} users restored successfully.`,
        duration: 3000,
      });
      clearSelection();
      // Refresh data - trigger re-fetch
      setSearchTerm(prev => prev);
    },
    onRestoreError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
    onExportSuccess: () => {
      toast({
        title: "Export complete",
        description: "Users exported to CSV file.",
        duration: 3000,
      });
    },
    onExportError: (error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Bulk action handlers
  const handleBulkStatusChange = (status: UserStatus) => {
    setBulkOperationType("status_change");
    setBulkTargetStatus(status);
    setBulkTargetRole(undefined);
    setBulkDialogOpen(true);
  };

  const handleBulkRoleChange = (role: UserType) => {
    setBulkOperationType("role_change");
    setBulkTargetRole(role);
    setBulkTargetStatus(undefined);
    setBulkDialogOpen(true);
  };

  const handleBulkDelete = () => {
    setBulkOperationType("soft_delete");
    setBulkTargetStatus(undefined);
    setBulkDialogOpen(true);
  };

  const handleBulkRestore = () => {
    setBulkOperationType("restore");
    setBulkTargetStatus(undefined);
    setBulkDialogOpen(true);
  };

  const handleBulkExport = () => {
    const selectedIdsArray = getSelectedIdsArray(selectedIds);
    bulkExportMutation.mutate({
      userIds: selectedIdsArray,
      includeDeleted: activeTab === "deleted",
    });
  };

  const handleBulkEmail = () => {
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async (request: { template: string; subject: string; body: string }) => {
    const selectedIdsArray = getSelectedIdsArray(selectedIds);
    setIsEmailSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No active session - please log in again");
      }

      const response = await fetch("/api/users/bulk/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          userIds: selectedIdsArray,
          ...request,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      toast({
        title: "Email sent",
        description: `Email sent to ${data.results.totalSuccess} users.`,
        duration: 3000,
      });

      clearSelection();
      setEmailDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
        duration: 3000,
      });
      throw error; // Re-throw to let the dialog handle the error state
    } finally {
      setIsEmailSending(false);
    }
  };

  // Fetch all matching IDs for "Select all matching" functionality
  const fetchAllMatchingIds = async () => {
    setIsLoadingMatchingIds(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No active session - please log in again");
      }

      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (searchTerm) params.append("search", searchTerm);
      if (activeTab === "deleted") params.append("includeDeleted", "true");

      const response = await fetch(`/api/users/bulk/ids?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch matching user IDs");
      }

      const data = await response.json();
      selectAllMatching(data.ids);
      setMatchingIdsCount(data.totalCount);

      if (data.hasMore) {
        toast({
          title: "Selection limit reached",
          description: `Selected ${data.count} of ${data.totalCount} matching users. Maximum 1000 users can be selected at once.`,
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch matching users",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoadingMatchingIds(false);
    }
  };

  const handleBulkConfirm = (reason?: string) => {
    const selectedIdsArray = getSelectedIdsArray(selectedIds);

    switch (bulkOperationType) {
      case "status_change":
        if (bulkTargetStatus) {
          bulkStatusChangeMutation.mutate({
            userIds: selectedIdsArray,
            status: bulkTargetStatus,
            reason,
          });
        }
        break;
      case "role_change":
        if (bulkTargetRole) {
          bulkRoleChangeMutation.mutate({
            userIds: selectedIdsArray,
            newRole: bulkTargetRole,
            reason,
          });
        }
        break;
      case "soft_delete":
        bulkDeleteMutation.mutate({
          userIds: selectedIdsArray,
          reason,
        });
        break;
      case "restore":
        bulkRestoreMutation.mutate({
          userIds: selectedIdsArray,
        });
        break;
    }

    setBulkDialogOpen(false);
  };

  // Clear selection when switching tabs
  useEffect(() => {
    clearSelection();
  }, [activeTab, clearSelection]);

  // --- Data Fetching Effect ---
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Move fetch functions inside useEffect to avoid dependency issues
    const fetchActiveUsers = async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", ITEMS_PER_PAGE.toString());
      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      params.append("sort", sortField);
      params.append("direction", sortDirection);

      const apiUrl = `/api/users?${params.toString()}`;

      // Get the session and ensure authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session - please log in again");
      }

      const response = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = null;
        }

        let errorMessage = "An unexpected error occurred";
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to access this resource";
        } else if (response.status === 401) {
          errorMessage = "Please log in again to continue";
        } else if (response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    };

    const fetchDeletedUsers = async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", ITEMS_PER_PAGE.toString());
      if (searchTerm) params.append("search", searchTerm);
      if (typeFilter !== "all") params.append("type", typeFilter);
      params.append("sort", sortField);
      params.append("direction", sortDirection);

      const apiUrl = `/api/users/deleted?${params.toString()}`;

      // Get the session and ensure authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No active session - please log in again");
      }

      const response = await fetch(apiUrl, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = null;
        }

        let errorMessage = "An unexpected error occurred";
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to access this resource";
        } else if (response.status === 401) {
          errorMessage = "Please log in again to continue";
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    };

    const fetchData = async () => {
      if (!isMounted) return;

      try {
        setIsLoading(true);
        setError(null);

        let data;
        if (activeTab === "active") {
          data = await fetchActiveUsers();

          // Validate and process active users data
          let validatedUsers: User[] = [];
          if (Array.isArray(data.users)) {
            validatedUsers = data.users
              .filter((user: any) => user && user.id && user.email)
              .map((user: any) => ({
                ...user,
                type:
                  ApiTypeUtils.normalizeUserType(user.type) !== "all"
                    ? (ApiTypeUtils.normalizeUserType(user.type) as UserType)
                    : ("VENDOR" as UserType),
                status:
                  ApiTypeUtils.normalizeUserStatus(user.status) !== "all"
                    ? (ApiTypeUtils.normalizeUserStatus(
                        user.status,
                      ) as UserStatus)
                    : ("PENDING" as UserStatus),
                name: user.name || user.contact_name || null,
                createdAt: user.createdAt || new Date().toISOString(),
              }));
          }

          if (isMounted) {
            setUsers(validatedUsers);
            setDeletedUsers([]); // Clear deleted users when viewing active
          }
        } else {
          data = await fetchDeletedUsers();

          // Validate and process deleted users data
          let validatedDeletedUsers: DeletedUser[] = [];
          if (Array.isArray(data.users)) {
            validatedDeletedUsers = data.users
              .filter(
                (user: any) => user && user.id && user.email && user.deletedAt,
              )
              .map((user: any) => ({
                ...user,
                type:
                  ApiTypeUtils.normalizeUserType(user.type) !== "all"
                    ? (ApiTypeUtils.normalizeUserType(user.type) as UserType)
                    : ("VENDOR" as UserType),
                status:
                  ApiTypeUtils.normalizeUserStatus(user.status) !== "all"
                    ? (ApiTypeUtils.normalizeUserStatus(
                        user.status,
                      ) as UserStatus)
                    : ("PENDING" as UserStatus),
                name: user.name || user.contact_name || null,
                createdAt: user.createdAt || new Date().toISOString(),
                deletedAt: user.deletedAt,
                deletedBy: user.deletedBy,
                deletionReason: user.deletionReason,
                deletedByUser: user.deletedByUser,
              }));
          }

          if (isMounted) {
            setDeletedUsers(validatedDeletedUsers);
            setUsers([]); // Clear active users when viewing deleted
          }
        }

        if (isMounted) {
          setTotalPages(
            typeof data.totalPages === "number" && data.totalPages > 0
              ? data.totalPages
              : 1,
          );
        }
      } catch (error) {
        console.error("API Fetch Error:", error);

        if (isMounted) {
          setError(
            error instanceof Error
              ? error.message
              : "An unknown error occurred while fetching users",
          );
          setUsers([]);
          setDeletedUsers([]);
          setTotalPages(1);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Clear any existing timer
    if (debounceTimer) clearTimeout(debounceTimer);

    // Set a new timer to fetch data after a delay
    debounceTimer = setTimeout(() => {
      fetchData();
    }, 300);

    // Cleanup function
    return () => {
      isMounted = false;
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [
    activeTab,
    page,
    statusFilter,
    typeFilter,
    searchTerm,
    sortField,
    sortDirection,
    supabase,
  ]);

  // --- Handlers ---
  const handleTabChange = (value: string) => {
    setActiveTab(value as "active" | "deleted");
    setPage(1); // Reset to first page on tab change
    setSearchTerm(""); // Clear search when switching tabs
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStatusFilter = (status: ApiUserStatusFilter) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleTypeFilter = (type: ApiUserTypeFilter) => {
    setTypeFilter(type);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: string) => {
    if (field !== sortField) return null;
    return sortDirection === "asc" ? (
      <ChevronDown className="ml-1 h-4 w-4 text-amber-600" />
    ) : (
      <ChevronDown className="ml-1 h-4 w-4 rotate-180 text-amber-600" />
    );
  };

  // Soft Delete Handler
  const handleSoftDelete = async (userId: string, reason: string) => {
    setIsDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: session ? `Bearer ${session.access_token}` : "",
        },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to delete user: ${response.status}`,
        );
      }

      // On success, remove user from active users list
      setUsers(users.filter((user) => user.id !== userId));

      toast({
        title: "User moved to trash",
        description: "The user has been successfully moved to trash.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Soft Delete Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUserToDelete(null);
      setShowDeleteDialog(false);
      setIsDeleting(false);
      setDeletionReason("");
    }
  };

  // Restore Handler
  const handleRestore = async (userId: string) => {
    setIsRestoring(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/users/${userId}/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session ? `Bearer ${session.access_token}` : "",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to restore user: ${response.status}`,
        );
      }

      // On success, remove user from deleted users list
      setDeletedUsers(deletedUsers.filter((user) => user.id !== userId));

      toast({
        title: "User restored",
        description: "The user has been successfully restored.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Restore Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to restore user",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUserToRestore(null);
      setShowRestoreDialog(false);
      setIsRestoring(false);
    }
  };

  // Permanent Delete Handler
  const handlePermanentDelete = async (userId: string, reason: string) => {
    setIsPermanentlyDeleting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/users/${userId}/purge`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: session ? `Bearer ${session.access_token}` : "",
        },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to permanently delete user: ${response.status}`,
        );
      }

      // On success, remove user from deleted users list
      setDeletedUsers(deletedUsers.filter((user) => user.id !== userId));

      toast({
        title: "User permanently deleted",
        description: "The user has been permanently deleted from the system.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Permanent Delete Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to permanently delete user",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUserToPermanentlyDelete(null);
      setShowPermanentDeleteDialog(false);
      setIsPermanentlyDeleting(false);
      setPermanentDeletionReason("");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {/* --- Header Section --- */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-4">
              <div className="flex items-center space-x-2">
                <h2 className="flex items-center text-xl font-bold text-slate-800">
                  <Users2 className="mr-2 h-5 w-5 text-amber-500" />
                  User Management
                </h2>
              </div>

              <div className="ml-auto flex items-center space-x-2">
                {/* --- Search Bar --- */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    type="text"
                    placeholder={`Search ${activeTab === "active" ? "active" : "deleted"} users...`}
                    className="w-[200px] pl-9 md:w-[300px]"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {/* --- Import and Add User Buttons (only show on active tab) --- */}
                {activeTab === "active" && canDeleteUsers && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setImportDialogOpen(true)}
                      className="whitespace-nowrap"
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      Import
                    </Button>
                    <Link href="/admin/users/new-user">
                      <Button size="sm" className="whitespace-nowrap">
                        <PlusCircle className="mr-1 h-4 w-4" />
                        Add User
                      </Button>
                    </Link>
                  </>
                )}
                {activeTab === "active" && !canDeleteUsers && (
                  <Link href="/admin/users/new-user">
                    <Button size="sm" className="whitespace-nowrap">
                      <PlusCircle className="mr-1 h-4 w-4" />
                      Add User
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* --- Tabs Section --- */}
            <div className="border-b bg-slate-50">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
                  <TabsTrigger
                    value="active"
                    className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:text-amber-600"
                  >
                    <Users2 className="h-4 w-4" />
                    Active Users
                  </TabsTrigger>
                  <TabsTrigger
                    value="deleted"
                    className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Deleted Users
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* --- Filters Section (only show on active tab for status filter) --- */}
            <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 p-4">
              {activeTab === "active" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="mr-1 h-4 w-4" />
                      Status
                      {statusFilter !== "all" && (
                        <Badge variant="outline" className="ml-2">
                          {ApiTypeUtils.getUserStatusDisplayLabel(
                            statusFilter as UserStatus,
                          )}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {ApiTypeUtils.getUserStatusOptions().map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleStatusFilter(option.value)}
                      >
                        {option.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-1 h-4 w-4" />
                    Type
                    {typeFilter !== "all" && (
                      <Badge variant="outline" className="ml-2">
                        {ApiTypeUtils.getUserTypeDisplayLabel(
                          typeFilter as UserType,
                        )}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ApiTypeUtils.getUserTypeOptions().map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleTypeFilter(option.value)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* --- Error State --- */}
            {error && (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            {/* --- Content Section with Tabs --- */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsContent value="active" className="m-0">
                {/* Select All Matching Banner */}
                {isSelectAllMatchingMode && canDeleteUsers && (
                  <div className="flex items-center justify-between bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        All {matchingCount} users matching your filters are selected
                        {matchingIdsCount && matchingIdsCount > matchingCount && (
                          <span className="text-amber-600"> (max 1000)</span>
                        )}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearSelection();
                      }}
                      className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
                {isLoading ? (
                  <LoadingSkeleton />
                ) : users.length > 0 ? (
                  <div className="overflow-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          {/* Checkbox column */}
                          {canDeleteUsers && (
                            <TableHead className="w-[50px]">
                              <div className="flex flex-col gap-1">
                                <Checkbox
                                  checked={isAllOnPageSelected && pageUserIds.length > 0}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      selectAll(pageUserIds);
                                    } else {
                                      deselectAll(pageUserIds);
                                      exitSelectAllMatchingMode();
                                    }
                                  }}
                                  aria-label="Select all users on this page"
                                />
                              </div>
                            </TableHead>
                          )}
                          <TableHead
                            className="min-w-[200px] cursor-pointer"
                            onClick={() => handleSort("name")}
                          >
                            <div className="flex items-center">
                              <span>Name / Email</span>
                              {getSortIcon("name")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[100px] cursor-pointer"
                            onClick={() => handleSort("type")}
                          >
                            <div className="flex items-center">
                              <span>Type</span>
                              {getSortIcon("type")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[140px] cursor-pointer"
                            onClick={() => handleSort("contact_number")}
                          >
                            <div className="flex items-center">
                              <span>Phone</span>
                              {getSortIcon("contact_number")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[100px] cursor-pointer"
                            onClick={() => handleSort("status")}
                          >
                            <div className="flex items-center">
                              <span>Status</span>
                              {getSortIcon("status")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[140px] cursor-pointer text-right"
                            onClick={() => handleSort("createdAt")}
                          >
                            <div className="flex items-center justify-end">
                              <span>Created</span>
                              {getSortIcon("createdAt")}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Select all matching row */}
                        {isAllOnPageSelected && !isSelectAllMatchingMode && canDeleteUsers && pageUserIds.length > 0 && (
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableCell colSpan={7} className="py-2 text-center">
                              <span className="text-sm text-slate-600">
                                All {pageUserIds.length} users on this page are selected.{" "}
                                <button
                                  onClick={fetchAllMatchingIds}
                                  disabled={isLoadingMatchingIds}
                                  className="text-amber-600 hover:text-amber-700 font-medium underline disabled:opacity-50"
                                >
                                  {isLoadingMatchingIds ? "Loading..." : "Select all users matching filters"}
                                </button>
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                        <AnimatePresence>
                          {users.map((user) => {
                            const typeInfo = userTypeConfig[user.type] || {
                              className: "bg-gray-100 text-gray-800",
                              icon: null,
                            };
                            const statusInfo = statusConfig[user.status] || {
                              className: "bg-gray-100 text-gray-800",
                              icon: null,
                            };

                            const createdAtDate = new Date(user.createdAt);
                            const isValidDate = !isNaN(createdAtDate.getTime());

                            const canSelectUser = user.type !== "SUPER_ADMIN";

                            return (
                              <motion.tr
                                key={user.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`group hover:bg-slate-50 ${isSelected(user.id) ? "bg-amber-50" : ""}`}
                              >
                                {/* Checkbox cell */}
                                {canDeleteUsers && (
                                  <TableCell>
                                    {canSelectUser ? (
                                      <Checkbox
                                        checked={isSelected(user.id)}
                                        onCheckedChange={() => toggleSelection(user.id)}
                                        aria-label={`Select ${user.name || user.email}`}
                                      />
                                    ) : (
                                      <Checkbox
                                        disabled
                                        aria-label="Cannot select Super Admin"
                                        title="Super Admin users cannot be modified"
                                      />
                                    )}
                                  </TableCell>
                                )}
                                <TableCell>
                                  <Link
                                    href={`/admin/users/${user.id}`}
                                    className="font-medium text-slate-800 transition-colors hover:text-amber-600 group-hover:underline"
                                  >
                                    <div>
                                      {user.name ||
                                        user.contact_name ||
                                        "Unnamed User"}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                      {user.email}
                                    </div>
                                    {user.type === "VENDOR" &&
                                      user.companyName && (
                                        <div className="mt-1 text-xs font-medium text-amber-600">
                                          🏢 {user.companyName}
                                        </div>
                                      )}
                                  </Link>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`${typeInfo.className} flex w-fit items-center gap-1 px-2 py-0.5 text-xs font-semibold`}
                                  >
                                    {typeInfo.icon}
                                    {ApiTypeUtils.getUserTypeDisplayLabel(
                                      user.type,
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    {user.contact_number || (
                                      <span className="italic text-slate-400">
                                        No phone
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`${statusInfo.className} flex w-fit items-center gap-1 px-2 py-0.5 text-xs font-semibold`}
                                  >
                                    {statusInfo.icon}
                                    {ApiTypeUtils.getUserStatusDisplayLabel(
                                      user.status,
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium text-slate-600">
                                  <div className="flex items-center justify-end gap-2">
                                    <span>
                                      {isValidDate
                                        ? createdAtDate.toLocaleDateString(
                                            undefined,
                                            {
                                              year: "numeric",
                                              month: "short",
                                              day: "numeric",
                                              timeZone: "UTC",
                                            },
                                          )
                                        : "Invalid Date"}
                                    </span>
                                    {canDeleteUsers && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-orange-600 opacity-0 transition-opacity hover:bg-orange-50 hover:text-orange-700 group-hover:opacity-100"
                                        onClick={() => {
                                          setUserToDelete(user);
                                          setShowDeleteDialog(true);
                                        }}
                                        disabled={user.type === "SUPER_ADMIN"}
                                        title="Move to Trash"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">
                                          Move to Trash
                                        </span>
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                      <Users2 className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">
                      No Active Users Found
                    </h3>
                    <p className="mt-1 max-w-md text-slate-500">
                      No active users match your current filters. Try adjusting
                      your search or filters.
                    </p>
                    <Link href="/admin/users/new-user" className="mt-4">
                      <Button variant="outline" className="mt-2">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New User
                      </Button>
                    </Link>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="deleted" className="m-0">
                {/* Select All Matching Banner for deleted users */}
                {isSelectAllMatchingMode && canDeleteUsers && activeTab === "deleted" && (
                  <div className="flex items-center justify-between bg-amber-50 px-4 py-3 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        All {matchingCount} deleted users matching your filters are selected
                        {matchingIdsCount && matchingIdsCount > matchingCount && (
                          <span className="text-amber-600"> (max 1000)</span>
                        )}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        clearSelection();
                      }}
                      className="text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
                {isLoading ? (
                  <LoadingSkeleton />
                ) : deletedUsers.length > 0 ? (
                  <div className="overflow-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          {/* Checkbox column for deleted users */}
                          {canDeleteUsers && (
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={isAllOnPageSelected && pageUserIds.length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    selectAll(pageUserIds);
                                  } else {
                                    deselectAll(pageUserIds);
                                    exitSelectAllMatchingMode();
                                  }
                                }}
                                aria-label="Select all deleted users on this page"
                              />
                            </TableHead>
                          )}
                          <TableHead
                            className="min-w-[200px] cursor-pointer"
                            onClick={() => handleSort("name")}
                          >
                            <div className="flex items-center">
                              <span>Name / Email</span>
                              {getSortIcon("name")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[100px] cursor-pointer"
                            onClick={() => handleSort("type")}
                          >
                            <div className="flex items-center">
                              <span>Type</span>
                              {getSortIcon("type")}
                            </div>
                          </TableHead>
                          <TableHead
                            className="min-w-[150px] cursor-pointer"
                            onClick={() => handleSort("deletedAt")}
                          >
                            <div className="flex items-center">
                              <span>Deleted Date</span>
                              {getSortIcon("deletedAt")}
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[130px]">
                            <span>Deleted By</span>
                          </TableHead>
                          <TableHead className="min-w-[150px]">
                            <span>Reason</span>
                          </TableHead>
                          <TableHead className="min-w-[150px] text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Select all matching row for deleted users */}
                        {isAllOnPageSelected && !isSelectAllMatchingMode && canDeleteUsers && pageUserIds.length > 0 && (
                          <TableRow className="bg-slate-50 hover:bg-slate-50">
                            <TableCell colSpan={8} className="py-2 text-center">
                              <span className="text-sm text-slate-600">
                                All {pageUserIds.length} deleted users on this page are selected.{" "}
                                <button
                                  onClick={fetchAllMatchingIds}
                                  disabled={isLoadingMatchingIds}
                                  className="text-amber-600 hover:text-amber-700 font-medium underline disabled:opacity-50"
                                >
                                  {isLoadingMatchingIds ? "Loading..." : "Select all deleted users matching filters"}
                                </button>
                              </span>
                            </TableCell>
                          </TableRow>
                        )}
                        <AnimatePresence>
                          {deletedUsers.map((user) => {
                            const typeInfo = userTypeConfig[user.type] || {
                              className: "bg-gray-100 text-gray-800",
                              icon: null,
                            };

                            const deletedAtDate = new Date(user.deletedAt);
                            const isValidDeletedDate = !isNaN(
                              deletedAtDate.getTime(),
                            );

                            return (
                              <motion.tr
                                key={user.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`group bg-red-50/30 hover:bg-red-50/60 ${isSelected(user.id) ? "bg-amber-50" : ""}`}
                              >
                                {/* Checkbox cell for deleted users */}
                                {canDeleteUsers && (
                                  <TableCell>
                                    <Checkbox
                                      checked={isSelected(user.id)}
                                      onCheckedChange={() => toggleSelection(user.id)}
                                      aria-label={`Select ${user.name || user.email}`}
                                    />
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                                    <div>
                                      <div className="font-medium text-slate-700">
                                        {user.name ||
                                          user.contact_name ||
                                          "Unnamed User"}
                                      </div>
                                      <div className="text-sm text-slate-500">
                                        {user.email}
                                      </div>
                                      {user.type === "VENDOR" &&
                                        user.companyName && (
                                          <div className="mt-1 text-xs font-medium text-amber-600">
                                            🏢 {user.companyName}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className={`${typeInfo.className} flex w-fit items-center gap-1 px-2 py-0.5 text-xs font-semibold opacity-70`}
                                  >
                                    {typeInfo.icon}
                                    {ApiTypeUtils.getUserTypeDisplayLabel(
                                      user.type,
                                    )}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {isValidDeletedDate
                                    ? deletedAtDate.toLocaleDateString(
                                        undefined,
                                        {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          timeZone: "UTC",
                                        },
                                      )
                                    : "Invalid Date"}
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {user.deletedByUser?.name ||
                                    user.deletedByUser?.email ||
                                    "Unknown"}
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  <div
                                    className="max-w-[150px] truncate"
                                    title={
                                      user.deletionReason ||
                                      "No reason provided"
                                    }
                                  >
                                    {user.deletionReason || (
                                      <span className="italic text-slate-400">
                                        No reason provided
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {canDeleteUsers && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-600 opacity-0 transition-opacity hover:bg-green-50 hover:text-green-700 group-hover:opacity-100"
                                        onClick={() => {
                                          setUserToRestore(user);
                                          setShowRestoreDialog(true);
                                        }}
                                        title="Restore User"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        <span className="sr-only">Restore</span>
                                      </Button>
                                    )}
                                    {canPermanentlyDelete && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                                        onClick={() => {
                                          setUserToPermanentlyDelete(user);
                                          setShowPermanentDeleteDialog(true);
                                        }}
                                        title="Permanently Delete"
                                      >
                                        <ShieldAlert className="h-4 w-4" />
                                        <span className="sr-only">
                                          Permanently Delete
                                        </span>
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                      <Trash2 className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">
                      No Deleted Users Found
                    </h3>
                    <p className="mt-1 max-w-md text-slate-500">
                      No deleted users match your current filters. Deleted users
                      will appear here when moved to trash.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* --- Pagination Section --- */}
            {!isLoading && totalPages > 1 && (
              <div className="border-t bg-slate-50 p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(page - 1)}
                        className={
                          page === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer hover:bg-slate-200"
                        }
                        aria-disabled={page === 1}
                      />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={`page-${i + 1}`}>
                        <PaginationLink
                          onClick={() => handlePageChange(i + 1)}
                          isActive={page === i + 1}
                          className={`cursor-pointer ${page === i + 1 ? "bg-amber-100 font-bold text-amber-800 hover:bg-amber-200" : "hover:bg-slate-200"}`}
                          aria-current={page === i + 1 ? "page" : undefined}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(page + 1)}
                        className={
                          page === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer hover:bg-slate-200"
                        }
                        aria-disabled={page === totalPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Soft Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-orange-500" />
              Move User to Trash
            </DialogTitle>
            <DialogDescription>
              This will move &quot;
              {userToDelete?.name || userToDelete?.email || "the selected user"}
              &quot; to the trash. The user can be restored later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="deletion-reason">
                Reason for deletion (optional)
              </Label>
              <Textarea
                id="deletion-reason"
                placeholder="e.g., Account violation, User request, Duplicate account..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setUserToDelete(null);
                setDeletionReason("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            {canDeleteUsers && (
              <Button
                onClick={() =>
                  userToDelete &&
                  handleSoftDelete(userToDelete.id, deletionReason)
                }
                disabled={isDeleting || userToDelete?.type === "SUPER_ADMIN"}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {isDeleting ? "Moving to Trash..." : "Move to Trash"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-green-500" />
              Restore User
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore &quot;
              {userToRestore?.name ||
                userToRestore?.email ||
                "the selected user"}
              &quot; and make them active again. They will regain access to the
              system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            {canDeleteUsers && (
              <AlertDialogAction
                onClick={() => userToRestore && handleRestore(userToRestore.id)}
                disabled={isRestoring}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {isRestoring ? "Restoring..." : "Restore User"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Dialog */}
      <Dialog
        open={showPermanentDeleteDialog}
        onOpenChange={setShowPermanentDeleteDialog}
      >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="h-5 w-5" />
              Permanently Delete User
            </DialogTitle>
            <DialogDescription className="text-red-600">
              ⚠️ <strong>DANGER:</strong> This action cannot be undone. The user
              &quot;
              {userToPermanentlyDelete?.name ||
                userToPermanentlyDelete?.email ||
                "the selected user"}
              &quot; and all their data will be permanently removed from the
              system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This will permanently delete all user data, including their
                orders, addresses, and file uploads. This action is irreversible
                and should only be used for GDPR compliance or security reasons.
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="permanent-deletion-reason">
                Reason for permanent deletion (required - minimum 10 characters)
              </Label>
              <Textarea
                id="permanent-deletion-reason"
                placeholder="e.g., GDPR data deletion request, Security breach, Legal requirement..."
                value={permanentDeletionReason}
                onChange={(e) => setPermanentDeletionReason(e.target.value)}
                className="mt-2"
                rows={3}
                required
              />
              <div className="text-muted-foreground mt-1 text-sm">
                {permanentDeletionReason.length}/10 characters minimum
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPermanentDeleteDialog(false);
                setUserToPermanentlyDelete(null);
                setPermanentDeletionReason("");
              }}
              disabled={isPermanentlyDeleting}
            >
              Cancel
            </Button>
            {canPermanentlyDelete && (
              <Button
                onClick={() =>
                  userToPermanentlyDelete &&
                  handlePermanentDelete(
                    userToPermanentlyDelete.id,
                    permanentDeletionReason,
                  )
                }
                disabled={
                  isPermanentlyDeleting || permanentDeletionReason.length < 10
                }
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isPermanentlyDeleting
                  ? "Permanently Deleting..."
                  : "Permanently Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar */}
      {canDeleteUsers && (
        <BulkActionBar
          selectedCount={selectedCount}
          onClearSelection={clearSelection}
          onStatusChange={handleBulkStatusChange}
          onRoleChange={isSuperAdmin ? handleBulkRoleChange : undefined}
          onDelete={handleBulkDelete}
          onRestore={activeTab === "deleted" ? handleBulkRestore : undefined}
          onExport={handleBulkExport}
          onEmail={handleBulkEmail}
          isLoading={isBulkLoading || isEmailSending}
          mode={activeTab}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* Bulk Confirm Dialog */}
      <BulkConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        operationType={bulkOperationType}
        selectedCount={selectedCount}
        onConfirm={handleBulkConfirm}
        isLoading={isBulkLoading}
        targetStatus={bulkTargetStatus}
        targetRole={bulkTargetRole}
      />

      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={(result) => {
          if (result.success.length > 0) {
            toast({
              title: "Import completed",
              description: `${result.success.length} users imported successfully.`,
              duration: 3000,
            });
            // Refresh the user list
            setSearchTerm((prev) => prev);
          }
        }}
      />

      {/* Bulk Email Dialog */}
      <BulkEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        selectedCount={selectedCount}
        onSend={handleSendEmail}
        isLoading={isEmailSending}
      />
    </div>
  );
};

export default UsersClient;
