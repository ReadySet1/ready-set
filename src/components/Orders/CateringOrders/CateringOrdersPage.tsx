// src/components/Orders/CateringOrders/CateringOrdersPage.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  ClipboardList,
  AlertCircle,
  Search,
  ChevronDown,
  Calendar,
  User,
  DollarSign,
  PlusCircle,
  Filter,
  ArrowUpDown,
  X
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Order, StatusFilter, UserRole } from "./types";
import { CateringOrdersTable } from "./CateringOrdersTable";
import { createClient } from "@/utils/supabase/client";
import { Prisma } from "@prisma/client";
import { CateringRequest, Profile, Address } from "@/types/prisma";
import { Order as OrderType } from "@/types/order";
import { CateringStatus } from "@/types/order-status";

// --- Interface, Type, Configs, Skeleton ---
enum CateringNeedHost {
  YES = 'YES',
  NO = 'NO',
  MAYBE = 'MAYBE'
}

enum DriverStatus {
  ARRIVED_AT_VENDOR = 'ARRIVED_AT_VENDOR',
  EN_ROUTE_TO_CLIENT = 'EN_ROUTE_TO_CLIENT',
  ARRIVED_TO_CLIENT = 'ARRIVED_TO_CLIENT',
  ASSIGNED = 'ASSIGNED',
  COMPLETED = 'COMPLETED'
}

interface CateringOrder {
  id: string;
  guid: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  orderNumber: string;
  brokerage?: string | null;
  status: OrderStatus;
  pickupDateTime?: Date | string | null;
  arrivalDateTime?: Date | string | null;
  completeDateTime?: Date | string | null;
  headcount?: number | null;
  needHost: CateringNeedHost;
  hoursNeeded?: number | null;
  numberOfHosts?: number | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  image?: string | null;
  orderTotal?: number | null;
  tip?: number | null;
  driverStatus?: DriverStatus | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
  user: {
    id: string;
    name: string;
    email: string;
    contactNumber?: string | null;
  };
  pickupAddress: {
    id: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    county?: string | null;
  };
  deliveryAddress: {
    id: string;
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    county?: string | null;
  };
  dispatches?: Array<{
    id: string;
    driver: {
      id: string;
      name: string;
      email: string;
      contactNumber?: string | null;
    };
  }>;
  order_type: 'catering';
}

// Define interface for the API response structure
interface CateringOrdersApiResponse {
  orders: CateringOrder[];
  totalPages: number;
}

type OrderStatus = 'ACTIVE' | 'PENDING' | 'CONFIRMED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED' | 'COMPLETED';

// Tab filter type for grouped status filtering
type StatusTabFilter = 'all_open' | 'new' | 'in_transit' | 'completed' | 'cancelled';

const statusConfig = {
  ACTIVE: { className: "bg-amber-100 text-amber-800 hover:bg-amber-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  PENDING: { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  CONFIRMED: { className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200", icon: <ClipboardList className="h-3 w-3 mr-1" /> },
  ASSIGNED: { className: "bg-blue-100 text-blue-800 hover:bg-blue-200", icon: <User className="h-3 w-3 mr-1" /> },
  IN_PROGRESS: { className: "bg-purple-100 text-purple-800 hover:bg-purple-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  DELIVERED: { className: "bg-teal-100 text-teal-800 hover:bg-teal-200", icon: <ClipboardList className="h-3 w-3 mr-1" /> },
  CANCELLED: { className: "bg-red-100 text-red-800 hover:bg-red-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  COMPLETED: { className: "bg-green-100 text-green-800 hover:bg-green-200", icon: <ClipboardList className="h-3 w-3 mr-1" /> },
};

const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || { className: "bg-gray-100 text-gray-800 hover:bg-gray-200", icon: null };
};

const LoadingSkeleton = () => (
  <div className="space-y-4 p-3 sm:p-4">
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-4">
      <Skeleton className="h-10 w-full sm:w-[250px]" />
      <Skeleton className="h-10 w-full sm:w-[200px]" />
    </div>
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-slate-50 p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 sm:h-8 w-full" />
          ))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-t p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            {[...Array(5)].map((_, j) => (
              <Skeleton 
                key={j} 
                className="h-4 sm:h-6 w-full" 
                style={{ animationDelay: `${i * 100 + j * 50}ms` }} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="flex justify-center">
      <Skeleton className="h-10 w-full sm:w-[300px]" />
    </div>
  </div>
);

// Search field type for filtering
type SearchFieldType = 'all' | 'date' | 'amount' | 'order_number' | 'client_name';

// Quick filter type for preset filters
type QuickFilterType = 'today' | 'week' | 'month' | 'high_value' | null;

const CateringOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusTabFilter, setStatusTabFilter] = useState<StatusTabFilter>('all_open');
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState<SearchFieldType>("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>(null);
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [limit] = useState(10); // Default limit for pagination
  const [userRoles, setUserRoles] = useState<UserRole>({
    isAdmin: false,
    isSuperAdmin: false,
    helpdesk: false
  });

  // Grouped status tabs for better organization
  const statusTabs: { value: StatusTabFilter; label: string; description: string }[] = [
    { value: 'all_open', label: 'All Open', description: 'All active orders' },
    { value: 'new', label: 'New', description: 'Pending & Confirmed' },
    { value: 'in_transit', label: 'In Transit', description: 'Active, Assigned, In Progress & Delivered' },
    { value: 'completed', label: 'Completed', description: 'Finished orders' },
    { value: 'cancelled', label: 'Cancelled', description: 'Cancelled orders' }
  ];

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Construct the query parameters
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sort: sortField,
          direction: sortDirection,
        });

        // Use statusFilter for grouped tabs, or status for single status
        if (statusTabFilter === 'completed') {
          queryParams.append('status', 'COMPLETED');
        } else if (statusTabFilter === 'cancelled') {
          queryParams.append('status', 'CANCELLED');
        } else {
          // Use the grouped statusFilter parameter
          queryParams.append('statusFilter', statusTabFilter);
        }

        // Add search term and search field if present
        if (searchTerm) {
          queryParams.append('search', searchTerm);
          queryParams.append('searchField', searchField);
        }

        // Add quick filter if present
        if (quickFilter) {
          queryParams.append('quickFilter', quickFilter);
        }

        // Get current user for auth token
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        // Make API call with authentication
        const response = await fetch(`/api/orders/catering-orders?${queryParams}`, {
          headers: {
            'Content-Type': 'application/json',
            // Use session access_token instead of user.id
            'Authorization': session ? `Bearer ${session.access_token}` : '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data: CateringOrdersApiResponse = await response.json();
        setOrders(data.orders);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching orders');
        console.error('Error fetching orders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [page, statusTabFilter, searchTerm, searchField, quickFilter, sortField, sortDirection, limit]);

  // New useEffect to fetch user roles
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error("No authenticated user found");
          return;
        }
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('type')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserRoles({
            isAdmin: profile.type.toLowerCase() === 'admin',
            isSuperAdmin: profile.type.toLowerCase() === 'super_admin',
            helpdesk: profile.type.toLowerCase() === 'helpdesk'
          });
        }
      } catch (error) {
        console.error("Error fetching user roles:", error);
      }
    };

    fetchUserRoles();
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update status tab filter handler
  const handleStatusTabFilter = (filter: StatusTabFilter) => {
    setStatusTabFilter(filter);
    setPage(1); // Reset to first page when changing filters
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle quick filter selection
  const handleQuickFilter = (filter: QuickFilterType) => {
    setQuickFilter(filter);
    setSearchTerm(""); // Clear search term when using quick filters
    setSearchField("all"); // Reset search field
    setPage(1); // Reset to first page
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSearchField("all");
    setQuickFilter(null);
    setPage(1);
  };

  // Get search placeholder based on selected field
  const getSearchPlaceholder = (): string => {
    switch (searchField) {
      case 'date':
        return "Enter date (e.g., 10/22/2025)...";
      case 'amount':
        return "Enter amount (e.g., 700.00)...";
      case 'order_number':
        return "Enter order number...";
      case 'client_name':
        return "Enter client name...";
      default:
        return "Search order #, client...";
    }
  };

  // Get quick filter label for display
  const getQuickFilterLabel = (): string | null => {
    switch (quickFilter) {
      case 'today':
        return "Today's Orders";
      case 'week':
        return "This Week";
      case 'month':
        return "This Month";
      case 'high_value':
        return "High Value (>$1000)";
      default:
        return null;
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? 
      <ChevronDown className="h-4 w-4 inline ml-1 opacity-50 rotate-180" /> :  
      <ChevronDown className="h-4 w-4 inline ml-1 opacity-50" />;
  };

  // Format date for display
  const formatDate = (dateInput: string | Date | null): string => {
    if (!dateInput) return 'N/A';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString(undefined, { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateInput: string | Date | null): string => {
    if (!dateInput) return 'N/A';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format currency for display
  const formatCurrency = (amount: number | undefined | null): string => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Add refresh handler for when an order is deleted
  const handleOrderDeleted = () => {
    // Refetch orders
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Construct the query parameters
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sort: sortField,
          direction: sortDirection,
        });

        // Use statusFilter for grouped tabs, or status for single status
        if (statusTabFilter === 'completed') {
          queryParams.append('status', 'COMPLETED');
        } else if (statusTabFilter === 'cancelled') {
          queryParams.append('status', 'CANCELLED');
        } else {
          queryParams.append('statusFilter', statusTabFilter);
        }

        // Add search term if present
        if (searchTerm) {
          queryParams.append('search', searchTerm);
        }

        // Get current user for auth token
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        // Make API call with authentication
        const response = await fetch(`/api/orders/catering-orders?${queryParams}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data: CateringOrdersApiResponse = await response.json();
        setOrders(data.orders);
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching orders');
        console.error('Error fetching orders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  };

  // Add a function to map CateringOrder to Order
  const mapToOrderType = (orders: CateringOrder[]): Order[] => {
    return orders.map((order) => ({
      id: order.id,
      order_number: order.orderNumber,
      status: order.status.toLowerCase(),
      date: order.pickupDateTime || order.createdAt,
      order_total: order.orderTotal ? Number(order.orderTotal) : 0,
      client_attention: order.clientAttention || undefined,
      user: order.user ? {
        id: order.user.id,
        name: order.user.name || 'N/A',
        email: order.user.email,
        contactNumber: order.user.contactNumber
      } : undefined,
      pickupAddress: {
        id: order.pickupAddress.id,
        street1: order.pickupAddress.street1,
        street2: order.pickupAddress.street2,
        city: order.pickupAddress.city,
        state: order.pickupAddress.state,
        zip: order.pickupAddress.zip,
        county: order.pickupAddress.county
      },
      deliveryAddress: {
        id: order.deliveryAddress.id,
        street1: order.deliveryAddress.street1,
        street2: order.deliveryAddress.street2,
        city: order.deliveryAddress.city,
        state: order.deliveryAddress.state,
        zip: order.deliveryAddress.zip,
        county: order.deliveryAddress.county
      }
    }));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6"> 
      
      {/* Page Title and New Order Button */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-start lg:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Catering Orders
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">
            Manage and track all catering orders across the platform
          </p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto">
          <Link href="/admin/catering-orders/new" passHref>
            <Button 
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md transition-all hover:shadow-lg w-full sm:w-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs - Mobile scrollable */}
      <div className="mb-4 sm:mb-6">
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusTabFilter(tab.value)}
              title={tab.description}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0
                ${statusTabFilter === tab.value
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card containing filters and the CateringOrdersTable */}
      <Card className="shadow-sm rounded-xl border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          
          {/* Filters Section - Mobile responsive */}
          <div className="border-b bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-4 sm:justify-between">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-2 flex-1">
                {/* Search Input - Full width on mobile */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={getSearchPlaceholder()}
                    className="pl-9 h-10 w-full"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (e.target.value) {
                        setQuickFilter(null); // Clear quick filter when typing
                      }
                    }}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => setSearchTerm("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Filter Controls - Responsive layout */}
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  {/* Quick Filters Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={quickFilter ? "default" : "outline"}
                        className={`gap-2 h-10 flex-1 sm:flex-none ${quickFilter ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                      >
                        <Filter className="h-4 w-4" />
                        <span className="sm:hidden md:inline">
                          {getQuickFilterLabel() || "Filters"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => handleQuickFilter('today')}
                        className={quickFilter === 'today' ? 'bg-amber-100' : ''}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Today&apos;s Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleQuickFilter('week')}
                        className={quickFilter === 'week' ? 'bg-amber-100' : ''}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        This Week&apos;s Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleQuickFilter('month')}
                        className={quickFilter === 'month' ? 'bg-amber-100' : ''}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        This Month&apos;s Orders
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleQuickFilter('high_value')}
                        className={quickFilter === 'high_value' ? 'bg-amber-100' : ''}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        High Value ({'>'}$1000)
                      </DropdownMenuItem>
                      {quickFilter && (
                        <>
                          <div className="my-1 border-t" />
                          <DropdownMenuItem onClick={() => handleQuickFilter(null)}>
                            <X className="h-4 w-4 mr-2" />
                            Clear Filter
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex gap-2 flex-1 sm:flex-none">
                    {/* Search Field Selector */}
                    <Select
                      value={searchField}
                      onValueChange={(value) => setSearchField(value as SearchFieldType)}
                    >
                      <SelectTrigger className="h-10 min-w-[100px] flex-1 sm:min-w-[130px]">
                        <SelectValue placeholder="Search by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Fields</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="order_number">Order Number</SelectItem>
                        <SelectItem value="client_name">Client Name</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Sort Direction Toggle */}
                    <Button variant="ghost" onClick={() => handleSort(sortField)} className="h-10 px-2 flex-shrink-0" title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}>
                      {sortDirection === 'asc' ?
                        <ChevronDown className="h-4 w-4 opacity-70 rotate-180" /> :
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      }
                      <span className="sr-only">Toggle Sort Direction</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchTerm || quickFilter) && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                <span className="text-sm text-slate-500">Active filters:</span>
                {quickFilter && (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer" onClick={() => handleQuickFilter(null)}>
                    {getQuickFilterLabel()}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                {searchTerm && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer" onClick={() => setSearchTerm("")}>
                    {searchField !== 'all' ? `${searchField.replace('_', ' ')}: ` : ''}{searchTerm}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-700">
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* CateringOrdersTable Component */}
          <div className="mt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div className="p-4 sm:p-6 text-center">
                <Alert variant="destructive" className="inline-flex flex-col items-center">
                  <AlertCircle className="h-5 w-5 mb-2" />
                  <AlertTitle>Error Fetching Orders</AlertTitle>
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              </div>
            ) : orders.length > 0 ? (
              <CateringOrdersTable
                orders={mapToOrderType(orders)}
                isLoading={isLoading}
                statusFilter={'active' as StatusFilter}
                onStatusFilterChange={() => {/* Tab filtering handled by parent */}}
                userRoles={userRoles}
                onOrderDeleted={handleOrderDeleted}
              />
            ) : (
              // Empty State - Mobile responsive
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">No orders found</h3>
                <p className="text-slate-500 max-w-md mt-1 text-sm sm:text-base">
                  No <span className="font-medium">{statusTabs.find(t => t.value === statusTabFilter)?.label}</span> orders match your current filters.
                </p>
                <Link href="/admin/catering-orders/new" className="mt-4">
                  <Button variant="outline" className="mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Order
                  </Button>
                </Link>
              </div>
            )}

            {/* Pagination Section - Mobile responsive */}
            {!isLoading && totalPages > 1 && (
              <div className="p-3 sm:p-4 border-t bg-slate-50">
                <Pagination>
                  <PaginationContent className="flex-wrap gap-1">
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(page - 1)} 
                        className={`${page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} text-sm`}
                      />
                    </PaginationItem>
                    {/* Basic Pagination - Consider a more advanced version for many pages */}
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i} className="hidden sm:block">
                        <PaginationLink 
                          onClick={() => handlePageChange(i + 1)}
                          isActive={page === i + 1}
                          className={`cursor-pointer text-sm ${page === i + 1 ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'hover:bg-slate-200'}`}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    {/* Mobile: Show current page info */}
                    <PaginationItem className="sm:hidden">
                      <span className="px-3 py-2 text-sm text-slate-600">
                        {page} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(page + 1)} 
                        className={`${page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} text-sm`}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CateringOrdersPage;