// src/components/Dashboard/DashboardHome.tsx

"use client";

import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Users,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart4,
  Calendar,
  ChevronRight,
  Menu,
  Briefcase,
  LayoutDashboard,
  ArrowUpRight,
  Loader2,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Activity,
  Package,
  UserPlus,
  Settings,
  RefreshCw,
  MapPin,
  FileText,
  User,
  Phone,
  Mail,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { encodeOrderNumber } from "@/utils/order";
import { CateringRequest, OrderStatus } from "@/types/order";
import { useDashboardMetrics } from "@/components/Dashboard/DashboardMetrics";
import { LoadingDashboard } from "../ui/loading";
import { ApplicationStatus, JobApplication } from "@/types/job-application";
import { useUser } from "@/contexts/UserContext";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import { CarrierOrdersBadge } from "@/components/Dashboard/CarrierManagement/CarrierOrdersBadge";
import { CarrierSummaryWidget } from "@/components/Dashboard/CarrierManagement/CarrierSummaryWidget";

// API Response Interfaces
interface JobApplicationsApiResponse {
  applications: JobApplication[];
  totalCount: number;
  totalPages: number;
}

interface OrdersApiResponse {
  orders: CateringRequest[];
  totalPages: number;
}

interface UsersApiResponse {
  users: any[];
  totalPages: number;
}

// Modern Stat Card Component with improved design
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: string;
  changeType?: "increase" | "decrease" | "neutral";
  color?: "blue" | "green" | "purple" | "orange" | "red";
}> = ({
  title,
  value,
  icon: Icon,
  change,
  changeType = "neutral",
  color = "blue",
}) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  const changeColors = {
    increase: "text-green-600 bg-green-50",
    decrease: "text-red-600 bg-red-50",
    neutral: "text-gray-600 bg-gray-50",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {change && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${changeColors[changeType]}`}
          >
            {changeType === "increase" && <TrendingUp className="h-3 w-3" />}
            {changeType === "decrease" && <TrendingDown className="h-3 w-3" />}
            {change}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-600">{title}</p>
      </div>
    </motion.div>
  );
};

// Quick Actions Component
const QuickActions: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.1 }}
    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
  >
    <div className="border-b border-slate-100 p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Settings className="h-5 w-5 text-blue-600" />
        Quick Actions
      </h3>
    </div>
    <div className="space-y-3 p-6">
      <Link href="/admin/catering-orders/new" className="block">
        <Button className="w-full justify-between bg-blue-600 text-white shadow-lg transition-all duration-200 hover:bg-blue-700 hover:shadow-xl">
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Order
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/admin/users/new-user" className="block">
        <Button
          variant="outline"
          className="w-full justify-between border-slate-200 transition-all duration-200 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add User
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </Link>
      <Link href="/admin/job-applications" className="block">
        <Button
          variant="ghost"
          className="w-full justify-between transition-all duration-200 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Review Applications
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  </motion.div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { className: string }> = {
    active: {
      className:
        "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200",
    },
    assigned: {
      className:
        "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200",
    },
    pending: {
      className:
        "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border border-yellow-200",
    },
    confirmed: {
      className:
        "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border border-green-200",
    },
    completed: {
      className:
        "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 border border-emerald-200",
    },
    cancelled: {
      className:
        "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200",
    },
  };

  const config = statusConfig[status.toLowerCase()];

  return (
    <Badge
      className={`${config?.className || "border border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800"} rounded-full px-3 py-1 font-medium`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

// Application Status Badge
const ApplicationStatusBadge: React.FC<{ status: ApplicationStatus }> = ({
  status,
}) => {
  const statusConfig: Record<
    ApplicationStatus,
    { className: string; label: string }
  > = {
    [ApplicationStatus.PENDING]: {
      className:
        "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-800 border border-yellow-200",
      label: "Pending",
    },
    [ApplicationStatus.APPROVED]: {
      className:
        "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border border-green-200",
      label: "Approved",
    },
    [ApplicationStatus.REJECTED]: {
      className:
        "bg-gradient-to-r from-red-50 to-red-100 text-red-800 border border-red-200",
      label: "Rejected",
    },
    [ApplicationStatus.INTERVIEWING]: {
      className:
        "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border border-blue-200",
      label: "Interviewing",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={`${config.className} rounded-full px-3 py-1 font-medium`}>
      {config.label}
    </Badge>
  );
};

// Modern Data Table Component with Card styling
const DataTableCard: React.FC<{
  title: string;
  icon: React.ElementType;
  data: any[];
  columns: {
    key: string;
    label: string;
    render?: (item: any) => React.ReactNode;
  }[];
  actions?: (item: any) => React.ReactNode;
  emptyMessage?: string;
  viewAllLink?: string;
}> = ({
  title,
  icon: Icon,
  data,
  columns,
  actions,
  emptyMessage = "No data available",
  viewAllLink,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.2 }}
    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
  >
    <div className="border-b border-slate-100 p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Icon className="h-5 w-5 text-blue-600" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {viewAllLink && (
            <Link href={viewAllLink}>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              >
                View All
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
    <div className="overflow-x-auto">
      {data.length === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Package className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, index) => (
              <tr key={index} className="transition-colors hover:bg-slate-50">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-6 py-4 text-sm text-slate-900"
                  >
                    {column.render ? column.render(item) : item[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </motion.div>
);

// Activity Feed Card
const ActivityFeedCard: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.3 }}
    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
  >
    <div className="border-b border-slate-100 p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Activity className="h-5 w-5 text-purple-600" />
        Recent Activity
      </h3>
    </div>
    <div className="p-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2">
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-900">New order created</p>
            <p className="text-xs text-slate-500">2 minutes ago</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-green-50 p-2">
            <UserPlus className="h-4 w-4 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-900">New user registered</p>
            <p className="text-xs text-slate-500">1 hour ago</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-purple-50 p-2">
            <Briefcase className="h-4 w-4 text-purple-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-900">Application approved</p>
            <p className="text-xs text-slate-500">3 hours ago</p>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

// Main Dashboard Component
export function ModernDashboardHome() {
  const { user, isLoading: userLoading, error: userError } = useUser();

  const [recentOrders, setRecentOrders] = useState<CateringRequest[]>([]);
  const [activeOrders, setActiveOrders] = useState<CateringRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [recentApplications, setRecentApplications] = useState<
    JobApplication[]
  >([]);
  const [pendingApplications, setPendingApplications] = useState<
    JobApplication[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
  } = useDashboardMetrics();

  // Get user display name
  const getUserDisplayName = () => {
    if (userProfile?.name) return userProfile.name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.email) return user.email.split("@")[0];
    return "Admin";
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = getUserDisplayName();
    if (name === "Admin") return "A";
    return name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    if (userLoading || !user) {
      if (!userLoading && !user) {
        setLoading(false);
      }
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Authentication required: No active session");
        }

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        };

        const results = await Promise.allSettled([
          fetch("/api/orders/catering-orders?recentOnly=true", { headers }),
          fetch("/api/users", { headers }),
          fetch("/api/admin/job-applications", { headers }),
          // Fetch user profile
          fetch("/api/users/current-user", { headers }),
        ]);

        // Handle orders
        const ordersResult = results[0];
        if (ordersResult.status === "fulfilled") {
          if (!ordersResult.value.ok) {
            const errorText = await ordersResult.value.text();
            throw new Error(
              `Orders API failed: ${ordersResult.value.status} - ${errorText}`,
            );
          }
          const ordersData =
            (await ordersResult.value.json()) as OrdersApiResponse;
          setRecentOrders(ordersData.orders || []);
          const activeOrdersList = (ordersData.orders || []).filter(
            (order: CateringRequest) =>
              [OrderStatus.ACTIVE, OrderStatus.ASSIGNED].includes(order.status),
          );
          setActiveOrders(activeOrdersList);
        } else {
          console.error("Failed to fetch orders:", ordersResult.reason);
          throw new Error("Failed to fetch orders data.");
        }

        // Handle users
        const usersResult = results[1];
        if (usersResult.status === "fulfilled") {
          if (!usersResult.value.ok) {
            const errorText = await usersResult.value.text();
            throw new Error(
              `Users API failed: ${usersResult.value.status} - ${errorText}`,
            );
          }
          const usersData =
            (await usersResult.value.json()) as UsersApiResponse;
          setUsers(usersData.users || []);
        } else {
          console.error("Failed to fetch users:", usersResult.reason);
          throw new Error("Failed to fetch users data.");
        }

        // Handle applications
        const applicationsResult = results[2];
        if (applicationsResult.status === "fulfilled") {
          if (!applicationsResult.value.ok) {
            const errorText = await applicationsResult.value.text();
            throw new Error(
              `Applications API failed: ${applicationsResult.value.status} - ${errorText}`,
            );
          }
          const applicationsData =
            (await applicationsResult.value.json()) as JobApplicationsApiResponse;
          setRecentApplications(applicationsData.applications || []);
          const pendingAppsList = (applicationsData.applications || []).filter(
            (app) => app.status === ApplicationStatus.PENDING,
          );
          setPendingApplications(pendingAppsList);
        } else {
          console.error(
            "Failed to fetch applications:",
            applicationsResult.reason,
          );
          throw new Error("Failed to fetch applications data.");
        }

        // Handle user profile
        const profileResult = results[3];
        if (profileResult.status === "fulfilled" && profileResult.value.ok) {
          const profileData = await profileResult.value.json();
          setUserProfile(profileData);
        }
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred fetching dashboard data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userLoading, user]);

  const combinedLoading = userLoading || loading || metricsLoading;
  const combinedError = userError || error || metricsError;

  if (combinedLoading) {
    return <LoadingDashboard />;
  }

  if (combinedError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h3 className="mb-2 text-center text-xl font-semibold text-slate-900">
            Error Loading Dashboard
          </h3>
          <p className="mb-6 text-center text-sm text-red-600">
            {String(combinedError)}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </motion.div>
      </div>
    );
  }

  // Calculate metrics
  const totalOrdersCount = Array.isArray(recentOrders)
    ? recentOrders.length
    : 0;
  const activeOrdersPercentage =
    totalOrdersCount > 0
      ? ((activeOrders.length / totalOrdersCount) * 100).toFixed(1)
      : "0";
  const totalApplicationsCount = Array.isArray(recentApplications)
    ? recentApplications.length
    : 0;
  const pendingApplicationsPercentage =
    totalApplicationsCount > 0
      ? ((pendingApplications.length / totalApplicationsCount) * 100).toFixed(1)
      : "0";
  const completedOrdersCount = recentOrders.filter(
    (order) => order.status === OrderStatus.COMPLETED,
  ).length;
  const completionRate =
    totalOrdersCount > 0
      ? ((completedOrdersCount / totalOrdersCount) * 100).toFixed(1)
      : "0";

  // Table configurations
  const ordersColumns = [
    {
      key: "id",
      label: "Order ID",
      render: (order: CateringRequest) => (
        <Link
          href={`/admin/catering-orders/${encodeURIComponent(order.orderNumber)}`}
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          #{order.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (order: CateringRequest) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-slate-100 text-xs text-slate-600">
              {order.user?.name?.charAt(0) || "C"}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-slate-800">
            {order.user?.name || "Unknown"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (order: CateringRequest) => <StatusBadge status={order.status} />,
    },
    {
      key: "date",
      label: "Date",
      render: (order: CateringRequest) => (
        <span className="text-slate-600">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const applicationsColumns = [
    {
      key: "name",
      label: "Applicant",
      render: (app: JobApplication) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-slate-100 text-xs text-slate-600">
              {app.firstName?.charAt(0) || "A"}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-slate-800">
            {app.firstName} {app.lastName}
          </span>
        </div>
      ),
    },
    {
      key: "position",
      label: "Position",
      render: (app: JobApplication) => (
        <span className="text-slate-600">
          {app.position || "Not specified"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (app: JobApplication) => (
        <ApplicationStatusBadge status={app.status} />
      ),
    },
    {
      key: "date",
      label: "Applied",
      render: (app: JobApplication) => (
        <span className="text-slate-600">
          {new Date(app.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const usersColumns = [
    {
      key: "name",
      label: "User",
      render: (user: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-slate-100 text-xs text-slate-600">
              {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-slate-800">
              {user.name || "Unknown User"}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (user: any) => (
        <Badge variant="outline" className="border-slate-200 font-medium">
          {user.type || "User"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (user: any) => (
        <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100">
          Active
        </Badge>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <LayoutDashboard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">
                    Dashboard
                  </h1>
                  <p className="hidden text-sm text-slate-500 sm:block">
                    Welcome back, {getUserDisplayName()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={
                    user?.user_metadata?.avatar_url ||
                    user?.user_metadata?.picture
                  }
                />
                <AvatarFallback className="bg-blue-100 text-blue-600">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="container mx-auto px-6 py-8"
      >
        <div className="mx-auto max-w-7xl space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Active Orders"
              value={activeOrders.length}
              icon={ClipboardList}
              change={`${activeOrdersPercentage}% of total`}
              changeType={
                Number(activeOrdersPercentage) > 50 ? "increase" : "neutral"
              }
              color="blue"
            />
            <StatCard
              title="Pending Applications"
              value={pendingApplications.length}
              icon={Briefcase}
              change={`${pendingApplicationsPercentage}% of total`}
              changeType={
                Number(pendingApplicationsPercentage) > 30
                  ? "increase"
                  : "neutral"
              }
              color="purple"
            />
            <StatCard
              title="Total Vendors"
              value={metrics.totalVendors}
              icon={BarChart4}
              change="+12.5% this month"
              changeType="increase"
              color="green"
            />
            <StatCard
              title="Total Revenue"
              value={`$${metrics.totalRevenue.toLocaleString()}`}
              icon={CheckCircle}
              change={
                metrics.totalRevenue > 0 ? "+8.2% this month" : "No revenue yet"
              }
              changeType={metrics.totalRevenue > 0 ? "increase" : "neutral"}
              color="orange"
            />
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left Column - Data Tables */}
            <div className="space-y-8 lg:col-span-2">
              <DataTableCard
                title="Active Catering Orders"
                icon={Calendar}
                data={activeOrders.slice(0, 5)}
                columns={ordersColumns}
                actions={(order) => (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-slate-50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/admin/catering-orders/${encodeURIComponent(order.orderNumber)}`}
                          className="flex items-center"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Order
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                emptyMessage="No active orders found"
                viewAllLink="/admin/catering-orders"
              />

              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <DataTableCard
                  title="Recent Job Applications"
                  icon={Briefcase}
                  data={recentApplications.slice(0, 5)}
                  columns={applicationsColumns}
                  emptyMessage="No applications found"
                  viewAllLink="/admin/job-applications"
                />

                <DataTableCard
                  title="Recent Users"
                  icon={Users}
                  data={users.slice(0, 5)}
                  columns={usersColumns}
                  emptyMessage="No users found"
                  viewAllLink="/admin/users"
                />
              </div>
            </div>

            {/* Right Column - Quick Actions & Widgets */}
            <div className="space-y-6">
              <QuickActions />
              <CarrierSummaryWidget />
              <ActivityFeedCard />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ModernDashboardHome;
