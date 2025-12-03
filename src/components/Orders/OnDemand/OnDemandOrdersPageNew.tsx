// src/components/Orders/OnDemand/OnDemandOrdersPageNew.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ClipboardList,
  AlertCircle,
  Search,
  ChevronDown,
  PlusCircle,
  Filter,
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
import { OnDemandOrder, StatusFilter, UserRole, OrderStatus } from "./types";
import { OnDemandOrdersTable } from "./OnDemandOrdersTable";
import { OnDemandOrdersPagination } from "./OnDemandOrdersPagination";
import { createClient } from "@/utils/supabase/client";

// --- Interface for the API response structure ---
interface OnDemandOrdersApiResponse {
  orders: ApiOnDemandOrder[];
  totalPages: number;
  totalCount: number;
}

// API response order structure (different from display structure)
interface ApiOnDemandOrder {
  id: string;
  guid: string | null;
  userId: string;
  pickupAddressId: string;
  deliveryAddressId: string;
  orderNumber: string;
  pickupDateTime?: Date | string | null;
  arrivalDateTime?: Date | string | null;
  completeDateTime?: Date | string | null;
  clientAttention?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  status: OrderStatus;
  orderTotal?: number | null;
  tip?: number | null;
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
}

const LoadingSkeleton = () => (
  <div className="space-y-4 p-3 sm:p-4">
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:space-x-4">
      <Skeleton className="h-10 w-full sm:w-[250px]" />
      <Skeleton className="h-10 w-full sm:w-[200px]" />
    </div>
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-slate-50 p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-6 sm:h-8 w-full" />
          ))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-t p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {[...Array(4)].map((_, j) => (
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

const OnDemandOrdersPageNew: React.FC = () => {
  const [orders, setOrders] = useState<OnDemandOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('ACTIVE');
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [limit] = useState(10);
  const [userRoles, setUserRoles] = useState<UserRole>({
    isAdmin: false,
    isSuperAdmin: false,
    helpdesk: false
  });

  // Status tabs matching catering orders
  const statusTabs = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'COMPLETED', label: 'Completed' }
  ];

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sort: sortField,
          direction: sortDirection,
          status: statusFilter,
        });

        if (searchTerm) {
          queryParams.append('search', searchTerm);
        }

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`/api/orders/on-demand-orders?${queryParams}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data: OnDemandOrdersApiResponse = await response.json();
        setOrders(mapToDisplayOrder(data.orders));
        setTotalPages(data.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching orders');
        console.error('Error fetching orders:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce fetch
    const debounceTimer = setTimeout(() => {
      fetchOrders();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [page, statusFilter, searchTerm, sortField, sortDirection, limit]);

  // Fetch user roles
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

  // Map API response to display format
  const mapToDisplayOrder = (apiOrders: ApiOnDemandOrder[]): OnDemandOrder[] => {
    return apiOrders.map((order) => ({
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

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusFilter = (status: OrderStatus) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleOrderDeleted = () => {
    // Refetch orders after deletion
    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString(),
          sort: sortField,
          direction: sortDirection,
          status: statusFilter,
        });

        if (searchTerm) {
          queryParams.append('search', searchTerm);
        }

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(`/api/orders/on-demand-orders?${queryParams}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session ? `Bearer ${session.access_token}` : '',
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data: OnDemandOrdersApiResponse = await response.json();
        setOrders(mapToDisplayOrder(data.orders));
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

  return (
    <div className="px-4 sm:px-6 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">

      {/* Page Title and New Order Button */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-start lg:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
            On-Demand Orders
          </h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">
            Manage and track all on-demand delivery orders
          </p>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto">
          <Link href="/on-demand-request" passHref>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md transition-all hover:shadow-lg w-full sm:w-auto"
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
              onClick={() => handleStatusFilter(tab.value as OrderStatus)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0
                ${statusFilter === tab.value
                  ? 'bg-cyan-100 text-cyan-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card containing filters and table */}
      <Card className="shadow-sm rounded-xl border-slate-200 overflow-hidden">
        <CardContent className="p-0">

          {/* Filters Section */}
          <div className="border-b bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-4 sm:justify-between">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-2 flex-1">
                {/* Search Input */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search order #, client..."
                    className="pl-9 h-10 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filter Controls */}
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2 h-10 flex-1 sm:flex-none">
                        <Filter className="h-4 w-4" />
                        <span className="sm:hidden md:inline">Filters</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem>Today's Orders</DropdownMenuItem>
                      <DropdownMenuItem>This Week's Orders</DropdownMenuItem>
                      <DropdownMenuItem>This Month's Orders</DropdownMenuItem>
                      <DropdownMenuItem>High Value ({'>'}$100)</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="flex gap-2 flex-1 sm:flex-none">
                    <Select
                      value={sortField}
                      onValueChange={(value) => { handleSort(value); }}
                    >
                      <SelectTrigger className="h-10 min-w-[100px] flex-1 sm:min-w-[120px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="order_total">Amount</SelectItem>
                        <SelectItem value="order_number">Order Number</SelectItem>
                        <SelectItem value="user.name">Client Name</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button variant="ghost" onClick={() => handleSort(sortField)} className="h-10 px-2 flex-shrink-0">
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
          </div>

          {/* Table Section */}
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
              <OnDemandOrdersTable
                orders={orders}
                isLoading={isLoading}
                statusFilter={statusFilter.toLowerCase() as StatusFilter}
                onStatusFilterChange={(status) => handleStatusFilter(status.toUpperCase() as OrderStatus)}
                userRoles={userRoles}
                onOrderDeleted={handleOrderDeleted}
              />
            ) : (
              // Empty State
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">No orders found</h3>
                <p className="text-slate-500 max-w-md mt-1 text-sm sm:text-base">
                  No {statusFilter !== 'ACTIVE' ? <span className="capitalize font-medium">{statusFilter.toLowerCase()}</span> : ''} orders match your current filters.
                </p>
                <Link href="/on-demand-request" className="mt-4">
                  <Button variant="outline" className="mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Order
                  </Button>
                </Link>
              </div>
            )}

            {/* Pagination Section */}
            {!isLoading && totalPages > 1 && (
              <div className="p-3 sm:p-4 border-t bg-slate-50">
                <OnDemandOrdersPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnDemandOrdersPageNew;
