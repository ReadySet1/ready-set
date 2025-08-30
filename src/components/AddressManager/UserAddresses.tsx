// src/components/AddressManager/UserAddresses.tsx

import React, { useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { Address } from "@/types/address";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertDialogTrigger,
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
  const [filterType, setFilterType] = useState<"all" | "shared" | "private">(
    "all",
  );
  const [deleteConfirmAddress, setDeleteConfirmAddress] =
    useState<Address | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 5,
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
  const handleFilterChange = useCallback((value: string) => {
    setFilterType(value as "all" | "shared" | "private");
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

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800 sm:p-6">
        <h2 className="text-center text-xl font-semibold leading-none tracking-tight sm:text-2xl">
          Your Addresses
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Manage your saved addresses for deliveries and pickups
        </p>

        {/* Tabs and Add Button - Stack on mobile */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            defaultValue={filterType}
            onValueChange={handleFilterChange}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 gap-1 sm:w-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All
              </TabsTrigger>
              <TabsTrigger value="private" className="text-xs sm:text-sm">
                Private
              </TabsTrigger>
              <TabsTrigger value="shared" className="text-xs sm:text-sm">
                Shared
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button onClick={handleAddNewAddress} className="w-full sm:w-auto">
            + Add New Address
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
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : addresses.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-gray-500">No addresses found</p>
            <Button onClick={handleAddNewAddress}>
              Add Your First Address
            </Button>
          </div>
        ) : (
          /* Mobile-friendly card layout instead of table */
          <div className="space-y-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Address Header */}
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {address.name || "Unnamed Location"}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {address.isShared && (
                        <Badge className="bg-blue-500 text-xs">Shared</Badge>
                      )}
                      {isAddressOwner(address) && (
                        <Badge className="bg-green-500 text-xs">Owner</Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons - Stack on mobile */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditAddress(address)}
                      disabled={!isAddressOwner(address)}
                      className="w-full sm:w-auto"
                    >
                      Edit
                    </Button>

                    <AlertDialog
                      open={deleteConfirmAddress?.id === address.id}
                      onOpenChange={(open) => {
                        if (!open) setDeleteConfirmAddress(null);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteConfirmAddress(address)}
                          disabled={
                            !isAddressOwner(address) || address.isShared
                          }
                          className="w-full sm:w-auto"
                        >
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this address? This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => handleDeleteAddress(address.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Address Details */}
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div>
                    <span className="font-medium">Address:</span>
                    <div className="mt-1">
                      {address.street1}
                      {address.street2 && <div>{address.street2}</div>}
                      <div>
                        {address.city}, {address.state} {address.zip}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                    <div>
                      <span className="font-medium">County:</span>
                      <span className="ml-2">{address.county || "N/A"}</span>
                    </div>
                    <div>
                      <span className="font-medium">Type:</span>
                      <span className="ml-2">
                        {address.isRestaurant
                          ? "Restaurant"
                          : "Standard Address"}
                      </span>
                    </div>
                  </div>

                  {address.locationNumber && (
                    <div>
                      <span className="font-medium">Phone:</span>
                      <span className="ml-2">{address.locationNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Section */}
      {!isLoading && pagination.totalPages > 1 && (
        <div
          className="mt-6 flex items-center justify-between border-t bg-slate-50 p-4"
          data-testid="pagination"
        >
          <Pagination>
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={handlePrevPage}
                  className={`${!pagination.hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} text-sm`}
                  data-testid="pagination-previous"
                />
              </PaginationItem>
              {/* Basic Pagination - Consider a more advanced version for many pages */}
              {[...Array(pagination.totalPages)].map((_, i) => (
                <PaginationItem key={i} className="hidden sm:block">
                  <PaginationLink
                    onClick={() => handlePageChange(i + 1)}
                    isActive={pagination.currentPage === i + 1}
                    className={`cursor-pointer text-sm ${pagination.currentPage === i + 1 ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "hover:bg-slate-200"}`}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {/* Mobile: Show current page info */}
              <PaginationItem className="sm:hidden">
                <span className="px-3 py-2 text-sm text-slate-600">
                  {pagination.currentPage} of {pagination.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={handleNextPage}
                  className={`${!pagination.hasNextPage ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} text-sm`}
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
