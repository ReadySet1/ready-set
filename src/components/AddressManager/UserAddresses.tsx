// src/components/AddressManager/UserAddresses.tsx

import React, { useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { Address, AddressFilter } from "@/types/address";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
} from "@/hooks/useAddresses";
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
import { MapPin, Plus } from "lucide-react";
import AddressModal from "./AddressModal";
import AddressCard from "./AddressCard";
import AddressCardSkeleton from "./AddressCardSkeleton";
import EmptyAddressState from "./EmptyAddressState";

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
    limit: 9, // Changed to 9 for better grid layout (3x3)
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
  const createAddressMutation = useCreateAddress();
  const updateAddressMutation = useUpdateAddress();
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
      // React Query will handle the error state
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

  const handleEditAddress = (address: Address) => {
    setAddressToEdit(address);
    setIsModalOpen(true);
  };

  const handleAddNewAddress = () => {
    setAddressToEdit(null);
    setIsModalOpen(true);
  };

  // Function to check if the current user is the address owner
  const isAddressOwner = (address: Address) => {
    return address.createdBy === user?.id;
  };

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

  // Get filter counts
  const getFilterCounts = () => {
    const all = data?.pagination?.totalCount || 0;
    const shared = addresses.filter((a) => a.isShared).length;
    const private_ = addresses.filter((a) => !a.isShared).length;
    return { all, shared, private: private_ };
  };

  const filterCounts = getFilterCounts();

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-center gap-2">
          <MapPin className="h-8 w-8 text-primary" />
          <h2 className="text-center text-3xl font-semibold leading-none tracking-tight">
            Your Addresses
          </h2>
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Manage your saved addresses for deliveries and pickups
        </p>

        {/* Filter Pills and Add Button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              onClick={() => handleFilterChange("all")}
              className={`transition-all duration-200 ease-out ${
                filterType === "all"
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              }`}
            >
              All ({filterCounts.all})
            </Button>
            <Button
              variant={filterType === "private" ? "default" : "outline"}
              onClick={() => handleFilterChange("private")}
              className={`transition-all duration-200 ease-out ${
                filterType === "private"
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              }`}
            >
              Private ({filterCounts.private})
            </Button>
            <Button
              variant={filterType === "shared" ? "default" : "outline"}
              onClick={() => handleFilterChange("shared")}
              className={`transition-all duration-200 ease-out ${
                filterType === "shared"
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              }`}
            >
              Shared ({filterCounts.shared})
            </Button>
          </div>

          <Button
            onClick={handleAddNewAddress}
            className="w-full transition-all duration-200 hover:scale-105 sm:w-auto"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add New Address
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {/* React Query error handling */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-500">
          {error.message || "An error occurred while loading addresses"}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="ml-2 h-auto p-1 text-red-700"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Content Area */}
      <div data-testid="addresses-content">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <AddressCardSkeleton key={i} />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          <EmptyAddressState
            onAddAddress={handleAddNewAddress}
            filterType={filterType}
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                isOwner={isAddressOwner(address)}
                onEdit={handleEditAddress}
                onDelete={(addr) => setDeleteConfirmAddress(addr)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmAddress}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmAddress(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this address? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() =>
                deleteConfirmAddress && handleDeleteAddress(deleteConfirmAddress.id)
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pagination Section */}
      {!isLoading && pagination.totalPages > 1 && (
        <div
          className="mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
          data-testid="pagination"
        >
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing{" "}
            {(pagination.currentPage - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)}{" "}
            of {pagination.totalCount} addresses
          </div>

          <Pagination className="transition-opacity duration-200">
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={handlePrevPage}
                  className={`${!pagination.hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer transition-colors duration-150 hover:bg-slate-200"} text-sm`}
                  data-testid="pagination-previous"
                />
              </PaginationItem>

              {/* Show page numbers on larger screens */}
              {[...Array(pagination.totalPages)].map((_, i) => (
                <PaginationItem key={i} className="hidden sm:block">
                  <PaginationLink
                    onClick={() => handlePageChange(i + 1)}
                    isActive={pagination.currentPage === i + 1}
                    className={`cursor-pointer text-sm transition-colors duration-150 ${
                      pagination.currentPage === i + 1
                        ? "bg-primary text-black hover:bg-primary/90"
                        : "hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}

              {/* Mobile: Show current page info */}
              <PaginationItem className="sm:hidden">
                <span className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                  {pagination.currentPage} of {pagination.totalPages}
                </span>
              </PaginationItem>

              <PaginationItem>
                <PaginationNext
                  onClick={handleNextPage}
                  className={`${!pagination.hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer transition-colors duration-150 hover:bg-slate-200"} text-sm`}
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
    </div>
  );
};

export default UserAddresses;
