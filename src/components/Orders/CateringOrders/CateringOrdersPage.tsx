// src/components/Orders/CateringOrders/CateringOrdersPage.tsx

"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
  ArrowUpDown
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

type OrderStatus = 'ACTIVE' | 'ASSIGNED' | 'CANCELLED' | 'COMPLETED';

const statusConfig = {
  ACTIVE: { className: "bg-amber-100 text-amber-800 hover:bg-amber-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  ASSIGNED: { className: "bg-blue-100 text-blue-800 hover:bg-blue-200", icon: <User className="h-3 w-3 mr-1" /> },
  CANCELLED: { className: "bg-red-100 text-red-800 hover:bg-red-200", icon: <AlertCircle className="h-3 w-3 mr-1" /> },
  COMPLETED: { className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200", icon: <ClipboardList className="h-3 w-3 mr-1" /> },
};

const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || { className: "bg-gray-100 text-gray-800 hover:bg-gray-200", icon: null };
};

const LoadingSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="flex items-center space-x-4">
      <Skeleton className="h-10 w-[250px]" />
      <Skeleton className="h-10 w-[200px]" />
    </div>
    <div className="rounded-lg border overflow-hidden">
      <div className="bg-slate-50 p-4">
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-8 w-full" />))}
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-t p-4">
          <div className="grid grid-cols-5 gap-4">
            {[...Array(5)].map((_, j) => (<Skeleton key={j} className="h-6 w-full" style={{ animationDelay: `${i * 100 + j * 50}ms` }} />))}
          </div>
        </div>
      ))}
    </div>
    <div className="flex justify-center">
      <Skeleton className="h-10 w-[300px]" />
    </div>
  </div>
);

// Define the fetch function for React Query
const fetchCateringOrders = async (
  page: number, 
  limit: number, 
  status: OrderStatus, 
  searchTerm: string, 
  sortField: string, 
  sortDirection: string
): Promise<CateringOrdersApiResponse> => {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort: sortField,
    direction: sortDirection,
    status: status,
  });

  if (searchTerm) {
    queryParams.append('search', searchTerm);
  }

  const supabase = createClient(); // Assuming createClient is from @/utils/supabase/client
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`/api/orders/catering-orders?${queryParams.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': session ? `Bearer ${session.access_token}` : '',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Failed to fetch orders and parse error response" }));
    throw new Error(errorData.message || 'Failed to fetch orders');
  }
  return response.json();
};

const CateringOrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string>("pickupDateTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [limit] = useState(10);
  const [userRoles, setUserRoles] = useState<UserRole>({
    isAdmin: false,
    isSuperAdmin: false,
    helpdesk: false
  });

  const statusTabs = [
    { value: 'ACTIVE' as OrderStatus, label: 'Active' },
    { value: 'ASSIGNED' as OrderStatus, label: 'Assigned' },
    { value: 'CANCELLED' as OrderStatus, label: 'Cancelled' },
    { value: 'COMPLETED' as OrderStatus, label: 'Completed' }
  ];

  // React Query for fetching orders
  const { 
    data: queryData,
    isLoading,
    isError,
    error,
  } = useQuery<CateringOrdersApiResponse, Error>({
    queryKey: ['cateringOrders', page, limit, statusFilter, searchTerm, sortField, sortDirection],
    queryFn: () => fetchCateringOrders(page, limit, statusFilter, searchTerm, sortField, sortDirection),
  });

  const orders = useMemo(() => queryData?.orders || [], [queryData]);
  const totalPages = useMemo(() => queryData?.totalPages || 1, [queryData]);

  React.useEffect(() => {
    const fetchUserRoles = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.app_metadata?.roles) {
        const roles = session.user.app_metadata.roles as string[];
        setUserRoles({
          isAdmin: roles.includes('admin'),
          isSuperAdmin: roles.includes('super_admin'),
          helpdesk: roles.includes('helpdesk'),
        });
      }
    };
    fetchUserRoles();
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleStatusFilter = (status: OrderStatus) => {
    setPage(1);
    setStatusFilter(status);
  };

  const handleSort = (field: string) => {
    const newDirection = sortField === field && sortDirection === "desc" ? "asc" : "desc";
    setSortField(field);
    setSortDirection(newDirection);
    setPage(1);
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? 
      <ChevronDown className="h-4 w-4 inline ml-1 opacity-50 rotate-180" /> :  
      <ChevronDown className="h-4 w-4 inline ml-1 opacity-50" />;
  };

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

  const formatCurrency = (amount: number | undefined | null): string => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleOrderDeleted = () => {
    console.log("Order deleted, data will refresh on next parameter change.");
  };

  const mappedOrders = useMemo(() => mapToOrderType(orders), [orders]);

  if (isLoading) return <LoadingSkeleton />;
  if (isError) {
    let errorMessage = "An unknown error occurred.";
    if (error) {
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error; // Should not happen with Error type in useQuery
      }
    }
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Fetching Orders</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-6 space-y-6"> 
      
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
            Catering Orders
          </h1>
          <p className="text-slate-500 mt-1">
            Manage and track all catering orders across the platform
          </p>
        </div>
        <Link href="/admin/catering-orders/new" passHref>
          <Button 
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md transition-all hover:shadow-lg w-full lg:w-auto"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Order
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex space-x-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusFilter(tab.value as OrderStatus)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${statusFilter === tab.value 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="shadow-sm rounded-xl border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          
          <div className="border-b bg-slate-50 p-4">
            <div className="flex flex-col lg:flex-row gap-4 justify-between">
              <div className="flex gap-2 flex-1 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search order #, client..."
                    className="pl-9 h-10 w-full"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 h-10">
                      <Filter className="h-4 w-4" />
                      <span className="hidden sm:inline">Filters</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem>Today's Orders</DropdownMenuItem>
                    <DropdownMenuItem>This Week's Orders</DropdownMenuItem>
                    <DropdownMenuItem>This Month's Orders</DropdownMenuItem>
                    <DropdownMenuItem>High Value ({'>'}$1000)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Select
                  value={sortField}
                  onValueChange={(value) => { handleSort(value); }}
                >
                  <SelectTrigger className="w-auto h-10 min-w-[120px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="order_total">Amount</SelectItem>
                    <SelectItem value="order_number">Order Number</SelectItem>
                    <SelectItem value="user.name">Client Name</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" onClick={() => handleSort(sortField)} className="h-10 px-2">
                  {sortDirection === 'asc' ? 
                    <ChevronDown className="h-4 w-4 opacity-70 rotate-180" /> : 
                    <ChevronDown className="h-4 w-4 opacity-70" /> 
                  }
                  <span className="sr-only">Toggle Sort Direction</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-0">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div className="p-6 text-center">
                <Alert variant="destructive" className="inline-flex flex-col items-center">
                  <AlertCircle className="h-5 w-5 mb-2" />
                  <AlertTitle>Error Fetching Orders</AlertTitle>
                  <AlertDescription>{(error as any) instanceof Error ? (error as any).message : String(error)}</AlertDescription>
                </Alert>
              </div>
            ) : orders.length > 0 ? (
              <CateringOrdersTable 
                orders={mappedOrders}
                isLoading={isLoading}
                statusFilter={statusFilter.toLowerCase() as StatusFilter}
                onStatusFilterChange={(status) => handleStatusFilter(status.toUpperCase() as OrderStatus)}
                userRoles={userRoles}
                onOrderDeleted={handleOrderDeleted}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">No orders found</h3>
                <p className="text-slate-500 max-w-md mt-1">
                  No {statusFilter !== 'ACTIVE' ? <span className="capitalize font-medium">{statusFilter}</span> : ''} orders match your current filters.
                </p>
                <Link href="/admin/catering-orders/new" className="mt-4">
                  <Button variant="outline" className="mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New Order
                  </Button>
                </Link>
              </div>
            )}

            {!isLoading && totalPages > 1 && (
              <div className="p-4 border-t bg-slate-50">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(page - 1)} 
                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"}
                      />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink 
                          onClick={() => handlePageChange(i + 1)}
                          isActive={page === i + 1}
                          className={`cursor-pointer ${page === i + 1 ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'hover:bg-slate-200'}`}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(page + 1)} 
                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"}
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

const mapToOrderType = (apiOrders: CateringOrder[]): Order[] => {
  return apiOrders.map(order => ({
    id: order.id,
    order_number: order.orderNumber,
    user: order.user,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    status: order.status as OrderType['status'],
    date: order.pickupDateTime ? new Date(order.pickupDateTime) : (order.createdAt ? new Date(order.createdAt) : new Date()),
    pickupDateTime: order.pickupDateTime ? new Date(order.pickupDateTime) : null,
    arrivalDateTime: order.arrivalDateTime ? new Date(order.arrivalDateTime) : null,
    completeDateTime: order.completeDateTime ? new Date(order.completeDateTime) : null,
    order_total: order.orderTotal !== null && order.orderTotal !== undefined 
                 ? new Prisma.Decimal(order.orderTotal).toNumber() 
                 : 0,
    driverStatus: order.driverStatus || undefined,
    driverName: order.dispatches?.[0]?.driver?.name || "N/A",
    order_type: 'catering',
    headcount: order.headcount,
    needHost: order.needHost,
    brokerage: order.brokerage,
    clientAttention: order.clientAttention,
    specialNotes: order.specialNotes,
    image: order.image,
    tip: order.tip !== null && order.tip !== undefined 
         ? new Prisma.Decimal(order.tip).toNumber() 
         : null,
    guid: order.guid,
    userId: order.userId,
    pickupAddressId: order.pickupAddressId,
    deliveryAddressId: order.deliveryAddressId,
    hoursNeeded: order.hoursNeeded,
    numberOfHosts: order.numberOfHosts,
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    updatedAt: order.updatedAt ? new Date(order.updatedAt) : new Date(),
    deletedAt: order.deletedAt ? new Date(order.deletedAt) : null,
    dispatches: order.dispatches?.map(d => ({
      id: d.id,
      driver: d.driver ? {
        id: d.driver.id,
        name: d.driver.name,
        email: d.driver.email,
        contactNumber: d.driver.contactNumber
      } : undefined
    })) || []
  } as Order));
};

export default CateringOrdersPage;