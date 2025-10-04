// src/components/AddressManager/UserAddresses.tsx

import React, { useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { Address, AddressFilter } from "@/types/address";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAddresses, useDeleteAddress } from "@/hooks/useAddresses";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AddressModal from "./AddressModal";
import AddressCard from "./AddressCard";
import AddressCardSkeleton from "./AddressCardSkeleton";
import EmptyAddressState from "./EmptyAddressState";
import { Plus, MapPin, RefreshCw } from "lucide-react";

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

const UserAddresses: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<AddressFilter>("all");
  const [deleteConfirmAddress, setDeleteConfirmAddress] =
    useState<Address | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 9, // 3x3 grid
  });

  // Get user from parent component's session
  React.useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = await import("@/utils/supabase/client").then((m) =>
          m.createClient(),
        );
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        setUser(user);
      } catch (error) {
        console.error("Error getting user:", error);
        setUser(null);
      }
    };

    getUser();
  }, []);

  // Use React Query for data fetching
  const { data, isLoading, error, refetch } = useAddresses(
    {
      filter: filterType,
      page: pagination.currentPage,
      limit: pagination.limit,
    },
    {
      enabled: !!user,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  );

  // Extract addresses and pagination from React Query response
  const addresses = data?.addresses || [];
  const paginationData = data?.pagination || pagination;

  // React Query mutations
  const deleteAddressMutation = useDeleteAddress();

  // Handle delete address using React Query mutation
  const handleDeleteAddress = async (addressId: string) => {
    try {
      await deleteAddressMutation.mutateAsync(addressId);
      setDeleteConfirmAddress(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting address:", errorMessage);
    }
  };

  // Memoize the handleAddressUpdated callback to prevent unnecessary re-renders
  const handleAddressUpdated = useCallback(() => {
    // Use React Query refetch to get fresh data
    if (user) {
      refetch();
    }
    setAddressToEdit(null);
    setIsModalOpen(false);
  }, [user, refetch]);

  const handleEditAddress = useCallback((address: Address) => {
    setAddressToEdit(address);
    setIsModalOpen(true);
  }, []);

  const handleAddNewAddress = useCallback(() => {
    setAddressToEdit(null);
    setIsModalOpen(true);
  }, []);

  // Function to check if the current user is the address owner
  const isAddressOwner = useCallback(
    (address: Address) => {
      return address.createdBy === user?.id;
    },
    [user],
  );

  // Memoize the filter change handler to prevent unnecessary re-renders
  const handleFilterChange = useCallback((value: AddressFilter) => {
    setFilterType(value);
    // Reset to first page when filter changes
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  // Memoize pagination handlers to prevent unnecessary re-renders
  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
  }, []);

  const handlePrevPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.max(1, prev.currentPage - 1),
    }));
  }, []);

  const handleNextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.min(prev.totalPages, prev.currentPage + 1),
    }));
  }, []);

  // Get counts for each filter type (simplified - you might want to fetch these separately)
  const getFilterCounts = () => {
    const totalCount = paginationData.totalCount;
    return {
      all: totalCount,
      shared: addresses.filter((a) => a.isShared).length,
      private: addresses.filter((a) => !a.isShared).length,
    };
  };

  const counts = getFilterCounts();

  if (isLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Spinner />
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-xl font-semibold">
          Please sign in to manage addresses
        </h2>
        <Button
          className="mt-4"
          onClick={() => (window.location.href = "/sign-in")}
        >
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header Section */}
      <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900">
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <MapPin className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Your Addresses
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your saved addresses for deliveries and pickups
          </p>
        </div>

        {/* Filter Tabs and Add Button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Custom Pill Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                filterType === "all"
                  ? "bg-primary text-black shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              All {counts.all > 0 && `(${counts.all})`}
            </button>
            <button
              onClick={() => handleFilterChange("private")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                filterType === "private"
                  ? "bg-primary text-black shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Private {counts.private > 0 && `(${counts.private})`}
            </button>
            <button
              onClick={() => handleFilterChange("shared")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
                filterType === "shared"
                  ? "bg-primary text-black shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              Shared {counts.shared > 0 && `(${counts.shared})`}
            </button>
          </div>

          {/* Add New Button */}
          <Button
            onClick={handleAddNewAddress}
            className="gap-2 shadow-sm transition-all hover:scale-105"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add New Address
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <span>
            {error.message || "An error occurred while loading addresses"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 text-red-700 hover:text-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Content Area */}
      <div data-testid="addresses-content" className="min-h-[400px]">
        {isLoading ? (
          /* Loading State with Skeleton Cards */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <AddressCardSkeleton key={i} />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          /* Empty State */
          <EmptyAddressState
            onAddAddress={handleAddNewAddress}
            filterType={filterType}
          />
        ) : (
          /* Address Cards Grid */
          <div className="grid grid-cols-1 gap-6 transition-all duration-300 md:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="animate-in fade-in-50 duration-300"
              >
                <AddressCard
                  address={address}
                  isOwner={isAddressOwner(address)}
                  onEdit={handleEditAddress}
                  onDelete={(addr) => setDeleteConfirmAddress(addr)}
                  isDeleting={
                    deleteAddressMutation.isPending &&
                    deleteConfirmAddress?.id === address.id
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Section */}
      {!isLoading && addresses.length > 0 && paginationData.totalPages > 1 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          {/* Page Info */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing{" "}
            {(paginationData.currentPage - 1) * paginationData.limit + 1} to{" "}
            {Math.min(
              paginationData.currentPage * paginationData.limit,
              paginationData.totalCount,
            )}{" "}
            of {paginationData.totalCount} addresses
          </p>

          {/* Pagination Controls */}
          <Pagination>
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={handlePrevPage}
                  className={`${
                    !paginationData.hasPrevPage
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                  } text-sm`}
                  data-testid="pagination-previous"
                />
              </PaginationItem>

              {/* Page Numbers */}
              {[...Array(paginationData.totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show first, last, current, and adjacent pages
                if (
                  pageNum === 1 ||
                  pageNum === paginationData.totalPages ||
                  Math.abs(pageNum - paginationData.currentPage) <= 1
                ) {
                  return (
                    <PaginationItem key={i} className="hidden sm:block">
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        isActive={paginationData.currentPage === pageNum}
                        className={`cursor-pointer text-sm transition-all ${
                          paginationData.currentPage === pageNum
                            ? "bg-primary text-black hover:bg-primary/90"
                            : "hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (
                  pageNum === paginationData.currentPage - 2 ||
                  pageNum === paginationData.currentPage + 2
                ) {
                  return (
                    <PaginationItem key={i} className="hidden sm:block">
                      <span className="px-2 text-gray-400">...</span>
                    </PaginationItem>
                  );
                }
                return null;
              })}

              {/* Mobile: Show current page info */}
              <PaginationItem className="sm:hidden">
                <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                  {paginationData.currentPage} of {paginationData.totalPages}
                </span>
              </PaginationItem>

              <PaginationItem>
                <PaginationNext
                  onClick={handleNextPage}
                  className={`${
                    !paginationData.hasNextPage
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                  } text-sm`}
                  data-testid="pagination-next"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Address Modal */}
      {isModalOpen && (
        <AddressModal
          onAddressUpdated={handleAddressUpdated}
          addressToEdit={addressToEdit}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmAddress}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmAddress(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {deleteConfirmAddress?.name || "this address"}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (deleteConfirmAddress) {
                  handleDeleteAddress(deleteConfirmAddress.id);
                }
              }}
            >
              {deleteAddressMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Deleting...
                </div>
              ) : (
                "Delete Address"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserAddresses;
