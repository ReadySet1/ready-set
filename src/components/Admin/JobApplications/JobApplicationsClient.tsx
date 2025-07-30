"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  Briefcase,
  UserCircle2,
  BarChart4,
  PieChart as PieChartIcon,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Eye,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Plus,
  ChevronRight,
  Building,
  GraduationCap,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { approveJobApplication, deleteJobApplication } from '@/app/actions/admin/job-applications';
import { createClient } from "@/utils/supabase/client";
import { ApplicationDetailDialog } from "./ApplicationDetailDialog";
import { 
  JobApplication, 
  ApplicationStatus, 
  JobApplicationStats 
} from "@/types/job-application";

// Constants
const COLORS = ["#3b82f6", "#10b981", "#ef4444", "#6366f1"];

// Enhanced status config with modern styling
const statusConfig = {
  [ApplicationStatus.PENDING]: { 
    className: "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200", 
    icon: <Clock className="h-3 w-3 mr-1" />,
    color: "amber"
  },
  [ApplicationStatus.APPROVED]: { 
    className: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200", 
    icon: <CheckCircle className="h-3 w-3 mr-1" />,
    color: "emerald"
  },
  [ApplicationStatus.REJECTED]: { 
    className: "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200", 
    icon: <XCircle className="h-3 w-3 mr-1" />,
    color: "red"
  },
  [ApplicationStatus.INTERVIEWING]: { 
    className: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200", 
    icon: <Calendar className="h-3 w-3 mr-1" />,
    color: "blue"
  },
};

const getStatusConfig = (status: ApplicationStatus) => {
  return statusConfig[status] || { 
    className: "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 border border-gray-200", 
    icon: null,
    color: "gray"
  };
};

// Modern loading skeleton
const ApplicationsSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
    <div className="container mx-auto px-6 py-8">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="h-12 w-80 mb-4" />
        <Skeleton className="h-6 w-60" />
      </div>
      
      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
      
      {/* Content Skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  </div>
);

// Modern Stats Overview Component
const StatsOverview: React.FC<{ stats: JobApplicationStats }> = ({ stats }) => {
  const statsCards = [
    {
      title: "Total Applications",
      value: stats.totalApplications,
      icon: <ClipboardList className="h-6 w-6" />,
      color: "blue",
      trend: "+12%",
      trendUp: true
    },
    {
      title: "Pending Review",
      value: stats.pendingApplications,
      icon: <Clock className="h-6 w-6" />,
      color: "amber",
      trend: "+5%",
      trendUp: true
    },
    {
      title: "Approved",
      value: stats.approvedApplications,
      icon: <CheckCircle className="h-6 w-6" />,
      color: "emerald",
      trend: "+8%",
      trendUp: true
    },
    {
      title: "In Interview",
      value: stats.interviewingApplications,
      icon: <Calendar className="h-6 w-6" />,
      color: "purple",
      trend: "-2%",
      trendUp: false
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          <Card className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    {stat.trendUp ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className={`text-xs font-medium ${stat.trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-xl bg-${stat.color}-100`}>
                  <div className={`text-${stat.color}-600`}>
                    {stat.icon}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

// Modern Application Card Component
const ApplicationCard: React.FC<{
  application: JobApplication;
  onView: (application: JobApplication) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDelete: (application: JobApplication) => void;
  isSubmitting: boolean;
  canDelete: boolean;
}> = ({ application, onView, onStatusChange, onDelete, isSubmitting, canDelete }) => {
  const statusInfo = getStatusConfig(application.status);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-semibold text-lg">
              {application.firstName[0]}{application.lastName[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {application.firstName} {application.lastName}
              </h3>
              <p className="text-sm text-slate-500">{application.position}</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView(application)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onStatusChange(application.id, ApplicationStatus.APPROVED)}
                disabled={isSubmitting || application.status === ApplicationStatus.APPROVED}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(application.id, ApplicationStatus.INTERVIEWING)}
                disabled={isSubmitting || application.status === ApplicationStatus.INTERVIEWING}
              >
                <Calendar className="mr-2 h-4 w-4 text-blue-500" />
                Schedule Interview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange(application.id, ApplicationStatus.REJECTED)}
                disabled={isSubmitting || application.status === ApplicationStatus.REJECTED}
              >
                <XCircle className="mr-2 h-4 w-4 text-red-500" />
                Reject
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(application)}
                    disabled={isSubmitting}
                    className="text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail className="h-4 w-4" />
            <span>{application.email}</span>
          </div>
          {application.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4" />
              <span>{application.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4" />
            <span>{application.addressCity}, {application.addressState}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4" />
            <span>Applied {new Date(application.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge className={`${statusInfo.className} flex items-center gap-1 px-3 py-1.5 font-semibold text-sm rounded-full shadow-sm`}>
            {statusInfo.icon}
            {application.status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(application)}
            className="hover:bg-slate-50"
          >
            View Details
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// Analytics Panel Component
const AnalyticsPanel: React.FC<{ stats: JobApplicationStats }> = ({ stats }) => {
  const chartData = [
    { name: "Pending", value: stats.pendingApplications, color: COLORS[0] },
    { name: "Approved", value: stats.approvedApplications, color: COLORS[1] },
    { name: "Rejected", value: stats.rejectedApplications, color: COLORS[2] },
    { name: "Interviewing", value: stats.interviewingApplications, color: COLORS[3] },
  ];

  const positionData = Object.entries(stats.applicationsByPosition).map(([position, count]) => ({
    position,
    count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-blue-600" />
            Application Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {chartData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white rounded-2xl shadow-sm border border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-purple-600" />
            Applications by Position
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {positionData.map((item, index) => (
              <div key={item.position} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{item.position}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${(item.count / Math.max(...positionData.map(p => p.count))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800 w-8 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Delete Confirmation Dialog
const DeleteConfirmationDialog: React.FC<{
  application: JobApplication | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (id: string) => void;
}> = ({ application, isOpen, isDeleting, onClose, onConfirm }) => {
  if (!application) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(isOpen) => {
      if (!isOpen && !isDeleting) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Confirm Deletion
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the job application for{" "}
            <span className="font-medium">
              {application.firstName} {application.lastName}
            </span>
            ? This action cannot be undone and all associated files will be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(application.id)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Application"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main client component
interface JobApplicationsClientProps {
  userType: string;
}

const JobApplicationsClient = ({ userType }: JobApplicationsClientProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [stats, setStats] = useState<JobApplicationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [positionFilter, setPositionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState<JobApplication | null>(null);
  const [isDeletingApplication, setIsDeletingApplication] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Check if user can delete applications (only admin and super_admin)
  const canDeleteApplications = ["admin", "super_admin"].includes(userType);

  // Format date helper
  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // CSV export function
  const exportToCSV = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No active session - please log in");
      }

      // Fetch all applications for export (remove pagination)
      const params = new URLSearchParams({
        limit: "1000", // Large number to get all applications
        search: searchTerm,
        status: statusFilter === "all" ? "" : statusFilter,
        position: positionFilter,
      });
      
      const response = await fetch(`/api/admin/job-applications?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch applications for export");
      }
      
      const data = await response.json();
      const exportApplications = data.applications as JobApplication[];

      // Convert to CSV
      const headers = [
        "Name",
        "Email", 
        "Phone",
        "Position",
        "Status",
        "City",
        "State",
        "Address",
        "Education",
        "Experience",
        "Skills",
        "Applied Date",
        "Cover Letter"
      ];

      const csvRows = [
        headers.join(","),
        ...exportApplications.map(app => [
          `"${app.firstName} ${app.lastName}"`,
          `"${app.email}"`,
          `"${app.phone || 'N/A'}"`,
          `"${app.position}"`,
          `"${app.status}"`,
          `"${app.addressCity}"`,
          `"${app.addressState}"`,
          `"${app.addressStreet}, ${app.addressCity}, ${app.addressState} ${app.addressZip}"`,
          `"${app.education || 'N/A'}"`,
          `"${app.workExperience || 'N/A'}"`,
          `"${app.skills || 'N/A'}"`,
          `"${formatDate(app.createdAt)}"`,
          `"${app.coverLetter ? 'Yes' : 'No'}"`
        ].join(","))
      ];

      // Create and download CSV file
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `job-applications-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Success",
        description: `Exported ${exportApplications.length} applications to CSV`,
        variant: "default",
      });

    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to export CSV",
        variant: "destructive",
      });
    }
  };

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No active session - please log in");
      }

      const response = await fetch("/api/admin/job-applications/stats", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      
      const data: JobApplicationStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setError("Failed to load application statistics");
      toast({
        title: "Error",
        description: "Failed to load application statistics",
        variant: "destructive",
      });
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Fetch applications
  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("No active session - please log in");
      }
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
        search: searchTerm,
        status: statusFilter === "all" ? "" : statusFilter,
        position: positionFilter,
      });
      
      const response = await fetch(`/api/admin/job-applications?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch applications");
      }
      const data = await response.json();
      setApplications(data.applications);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Error fetching applications:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load applications";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter, positionFilter]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    fetchStats();
    fetchApplications();
  }, [fetchStats, fetchApplications]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Handle status change
  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    setIsSubmitting(true);
    setError(null);

    try {
      let resultMessage = "";
      let updatedApp: JobApplication | undefined;

      if (newStatus === ApplicationStatus.APPROVED) {
        const result = await approveJobApplication(id);
        resultMessage = result.message || "Application approved successfully.";
        updatedApp = applications.find(app => app.id === id);
        if (updatedApp) {
            updatedApp = { ...updatedApp, status: newStatus };
        }
      } else {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error("No active session - please log in");
        }
        
        const response = await fetch(`/api/admin/job-applications/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) {
          let errorData = { error: `API error ${response.status}` };
          try {
            errorData = await response.json();
          } catch (e) { /* Ignore json parsing error */ }
          throw new Error(
            errorData.error || `Failed to update status to ${newStatus}`,
          );
        }
        const responseData = await response.json();
        if (!responseData.success || !responseData.application) {
          throw new Error(
            responseData.error || `Failed to update status to ${newStatus}`
          );
        }
        updatedApp = responseData.application as JobApplication;
        resultMessage = `Application status updated to ${updatedApp.status}`;
      }

      if (updatedApp) {
        const finalUpdatedApp = updatedApp;
        setApplications((prevApps) =>
          prevApps.map((app) =>
            app.id === id ? finalUpdatedApp : app,
          ),
        );
        if (selectedApplication && selectedApplication.id === id) {
          setSelectedApplication(finalUpdatedApp);
        }
      } else {
        setApplications((prevApps) =>
          prevApps.map((app) =>
            app.id === id ? { ...app, status: newStatus } : app,
          ),
        );
        if (selectedApplication && selectedApplication.id === id) {
          setSelectedApplication({ ...selectedApplication, status: newStatus });
        }
      }

      toast({
        title: "Success",
        description: resultMessage,
        variant: "default",
      });

      fetchStats();

      if (selectedApplication && selectedApplication.id === id && (newStatus === ApplicationStatus.REJECTED || newStatus === ApplicationStatus.APPROVED)) {
        setIsDetailDialogOpen(false);
      }
    } catch (error: any) {
      console.error("Error updating application status:", error);
      const description = error.message || "An unexpected error occurred. Please try again.";
      setError(description);
      toast({
        title: "Error",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle application view
  const handleViewApplication = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsDetailDialogOpen(true);
  };

  // Handle application deletion
  const handleDeleteApplication = async (id: string) => {
    setIsDeletingApplication(true);
    setError(null);

    try {
      const result = await deleteJobApplication(id);

      if (!result.success) {
        throw new Error(result.message || "Failed to delete application");
      }

      setApplications((prevApps) =>
        prevApps.filter((app) => app.id !== id)
      );

      toast({
        title: "Success",
        description: result.message || "Application deleted successfully",
        variant: "default",
      });

      fetchStats();
    } catch (error: any) {
      console.error("Error deleting application:", error);
      const description = error.message || "An unexpected error occurred. Please try again.";
      setError(description);
      toast({
        title: "Error",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsDeletingApplication(false);
      setIsDeleteDialogOpen(false);
      setApplicationToDelete(null);
    }
  };

  // Open delete confirmation dialog
  const openDeleteConfirmation = (application: JobApplication) => {
    setApplicationToDelete(application);
    setIsDeleteDialogOpen(true);
  };

  if ((isLoading || isStatsLoading) && !stats) {
    return <ApplicationsSkeleton />;
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center p-8 bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md mx-4"
        >
          <div className="mb-6 mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Error Loading Data</h2>
          <p className="text-slate-500 mb-6">Failed to load application statistics</p>
          <Button
            variant="default"
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Retry
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-6 py-8"
      >
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl font-bold text-slate-800">Job Applications</h1>
                <Badge className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1.5 font-semibold text-sm rounded-full">
                  {stats.totalApplications} Total
                </Badge>
              </div>
              <p className="text-slate-600">
                Manage and review candidate applications efficiently
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                onClick={() => {
                  fetchStats();
                  fetchApplications();
                }}
                disabled={isLoading || isStatsLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${(isLoading || isStatsLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <StatsOverview stats={stats} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="applications" className="w-full">
          <div className="border-b border-slate-200 mb-8">
            <TabsList className="w-auto bg-transparent border-b-0 p-0 mb-0 flex">
              <TabsTrigger 
                value="applications" 
                className="text-sm py-3 px-6 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none font-medium"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Applications
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="text-sm py-3 px-6 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none font-medium"
              >
                <BarChart4 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Applications Tab */}
          <TabsContent value="applications" className="mt-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Filters */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search applications..."
                        className="pl-10 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as ApplicationStatus | "all")}
                    >
                      <SelectTrigger className="w-40 bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value={ApplicationStatus.PENDING}>Pending</SelectItem>
                        <SelectItem value={ApplicationStatus.APPROVED}>Approved</SelectItem>
                        <SelectItem value={ApplicationStatus.REJECTED}>Rejected</SelectItem>
                        <SelectItem value={ApplicationStatus.INTERVIEWING}>Interviewing</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={positionFilter === "all" ? "all" : positionFilter}
                      onValueChange={(value) => setPositionFilter(value === "all" ? "" : value)}
                    >
                      <SelectTrigger className="w-48 bg-slate-50 border-slate-200">
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Positions</SelectItem>
                        <SelectItem value="Driver for Catering Deliveries">Driver</SelectItem>
                        <SelectItem value="Virtual Assistant">Virtual Assistant</SelectItem>
                        <SelectItem value="Other Positions">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Applications Grid */}
              <div className="p-6">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : applications.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <ClipboardList className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-2">No Applications Found</h3>
                    <p className="text-slate-500">No applications match your current filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {applications.map((application) => (
                      <ApplicationCard
                        key={application.id}
                        application={application}
                        onView={handleViewApplication}
                        onStatusChange={handleStatusChange}
                        onDelete={openDeleteConfirmation}
                        isSubmitting={isSubmitting}
                        canDelete={canDeleteApplications}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center mt-8">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                        className="rounded-xl"
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <Button
                              key={pageNum}
                              variant={page === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-10 h-10 rounded-xl"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                        className="rounded-xl"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsPanel stats={stats} />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Application Detail Dialog */}
      <ApplicationDetailDialog
        application={selectedApplication}
        open={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        onStatusChange={handleStatusChange}
        onDeleteClick={(application) => openDeleteConfirmation(application)}
        isSubmitting={isSubmitting}
        error={error}
        canDeleteApplications={canDeleteApplications}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        application={applicationToDelete}
        isOpen={isDeleteDialogOpen}
        isDeleting={isDeletingApplication}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setApplicationToDelete(null);
        }}
        onConfirm={handleDeleteApplication}
      />
    </div>
  );
};

export default JobApplicationsClient; 