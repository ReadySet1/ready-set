// src/components/AddressManager/index.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Address } from "@/types/address";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AddressModal from "./AddressModal";
import EmptyAddressState from "./EmptyAddressState";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { Phone, Info } from "lucide-react";

interface AddressManagerProps {
  onAddressesLoaded?: (addresses: Address[]) => void;
  onAddressSelected: (addressId: string) => void;
  onError?: (error: string) => void;
  defaultFilter?: "all" | "shared" | "private";
  showFilters?: boolean;
  showManagementButtons?: boolean;
  onRefresh?: (refreshFn: () => void) => void;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
}

const AddressManager: React.FC<AddressManagerProps> = ({
  onAddressesLoaded,
  onAddressSelected,
  onError,
  defaultFilter = "all",
  showFilters = true,
  showManagementButtons = true,
  onRefresh,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [filteredAddresses, setFilteredAddresses] = useState<Address[]>([]);
  const [filterType, setFilterType] = useState<"all" | "shared" | "private">(
    defaultFilter,
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null);
  const [addressCounts, setAddressCounts] = useState({
    all: 0,
    shared: 0,
    private: 0,
  });
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
    limit: 5,
  });
  const isRequestPending = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAttempts = useRef(0);
  const MAX_FETCH_ATTEMPTS = 3;
  const hasInitialFetch = useRef(false); // Flag to track if it's the initial fetch

  // Create refs to store current pagination values to avoid dependency issues
  const currentPageRef = useRef(pagination.currentPage);
  const limitRef = useRef(pagination.limit);

  // Update refs when pagination changes
  useEffect(() => {
    currentPageRef.current = pagination.currentPage;
    limitRef.current = pagination.limit;
  }, [pagination.currentPage, pagination.limit]);

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(user);
          if (!user) {
            setError("Authentication required to load addresses.");
            if (onError) {
              onError("Authentication required to load addresses.");
            }
            setIsLoading(false);
          } else {
            // User is authenticated, set loading to false so addresses can be fetched
            setIsLoading(false);
            fetchAttempts.current = 0; // Reset attempts for new user
            hasInitialFetch.current = false; // Allow initial fetch for new user
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        if (isMounted) {
          setError("Error fetching user data.");
          if (onError) {
            onError("Error fetching user data.");
          }
          setIsLoading(false);
        }
      }
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        const newUser = session?.user ?? null;
        setUser(newUser);

        if (event === "SIGNED_IN" && newUser) {
          setError(null);
          setIsLoading(false); // Allow addresses to be fetched
          fetchAttempts.current = 0; // Reset attempts for new user
          hasInitialFetch.current = false; // Allow initial fetch for new user
        } else if (event === "SIGNED_OUT") {
          setAddresses([]);
          setError("Authentication required to load addresses.");
          if (onError) {
            onError("Authentication required to load addresses.");
          }
          setIsLoading(false);
          fetchAttempts.current = 0; // Reset attempts
        }
      },
    );

    return () => {
      isMounted = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      authListener.subscription.unsubscribe();
    };
  }, [supabase, onError]);

  const debouncedFetch = useCallback((fn: () => Promise<void>) => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    if (fetchAttempts.current >= MAX_FETCH_ATTEMPTS) {
      console.warn(
        `Maximum fetch attempts (${MAX_FETCH_ATTEMPTS}) reached. Stopping further requests.`,
      );
      return;
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fn();
      fetchTimeoutRef.current = null;
    }, 100); // Reduced delay for better testing
  }, []);

  const fetchAddresses = useCallback(async () => {
    if (isRequestPending.current) {
      return;
    }

    if (!user) {
      return;
    }

    fetchAttempts.current += 1;

    if (fetchAttempts.current > MAX_FETCH_ATTEMPTS) {
      setError(
        `Address loading failed after ${MAX_FETCH_ATTEMPTS} attempts. Please try again later or enter address manually.`,
      );
      if (onError) {
        onError(
          `Address loading failed after ${MAX_FETCH_ATTEMPTS} attempts. Please try again later or enter address manually.`,
        );
      }
      return;
    }

    // Get current session with refresh if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setIsLoading(false);
      setError("Authentication required to load addresses.");
      if (onError) {
        onError("Authentication required to load addresses.");
      }
      return;
    }

    isRequestPending.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Use ref values to avoid dependency issues
      const currentPage = currentPageRef.current;
      const limit = limitRef.current;

      const response = await fetch(
        `/api/addresses?filter=${filterType}&page=${currentPage}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError("Unauthorized: Please log in again.");
          if (onError) {
            onError("Unauthorized: Please log in again.");
          }
        } else {
          setError(`Error fetching addresses: ${response.statusText}`);
          if (onError) {
            onError(`Error fetching addresses: ${response.statusText}`);
          }
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle both old format (array) and new format (paginated object)
      let validAddresses: Address[] = [];
      let paginationData: PaginationData = {
        currentPage: currentPageRef.current,
        totalPages: 1,
        totalCount: 0,
        hasNextPage: false,
        hasPrevPage: false,
        limit: limitRef.current,
      };

      if (Array.isArray(data)) {
        // Old format - backward compatibility
        validAddresses = data;
        paginationData = {
          currentPage: 1,
          totalPages: 1,
          totalCount: data.length,
          hasNextPage: false,
          hasPrevPage: false,
          limit: data.length,
        };
      } else if (data.addresses && data.pagination) {
        // New paginated format
        validAddresses = data.addresses;
        paginationData = data.pagination;
      } else {
        validAddresses = [];
      }

      // Set addresses first, then call callback in next tick to avoid render phase issues
      setAddresses(validAddresses);

      // Calculate address counts for filter pills
      const counts = {
        all: validAddresses.length,
        shared: validAddresses.filter((addr) => addr.isShared).length,
        private: validAddresses.filter(
          (addr) => !addr.isShared && addr.createdBy === user?.id,
        ).length,
      };
      setAddressCounts(counts);

      // Call onAddressesLoaded in next tick to avoid React render phase violations
      if (onAddressesLoaded) {
        setTimeout(() => {
          onAddressesLoaded(validAddresses);
        }, 0);
      }
      setPagination(paginationData);

      fetchAttempts.current = 0;
    } catch (err) {
      setAddresses([]);
      if (onError) {
        onError(
          `Error fetching addresses: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    } finally {
      setIsLoading(false);
      isRequestPending.current = false;
    }
  }, [user, filterType, onAddressesLoaded, onError, supabase.auth]);

  // Main effect for fetching addresses
  useEffect(() => {
    if (user && !hasInitialFetch.current) {
      hasInitialFetch.current = true;
      debouncedFetch(fetchAddresses);
    }
  }, [user, filterType, debouncedFetch, fetchAddresses]);

  // Separate effect for filter changes
  useEffect(() => {
    if (user && hasInitialFetch.current) {
      debouncedFetch(fetchAddresses);
    }
  }, [filterType, user, debouncedFetch, fetchAddresses]);

  // Separate effect for pagination changes (only when manually changed)
  useEffect(() => {
    if (user && hasInitialFetch.current && currentPageRef.current > 1) {
      debouncedFetch(fetchAddresses);
    }
  }, [pagination.currentPage, user, debouncedFetch, fetchAddresses]);

  // Create a stable refresh function
  const refreshAddresses = useCallback(() => {
    fetchAttempts.current = 0; // Reset attempts for manual refresh
    hasInitialFetch.current = false; // Allow refetch on manual refresh
    fetchAddresses();
  }, [fetchAddresses]);

  // Expose refresh function to parent component
  useEffect(() => {
    if (onRefresh) {
      onRefresh(refreshAddresses);
    }
  }, [onRefresh, refreshAddresses]);

  const handleAddAddress = useCallback(
    async (newAddress: Partial<Address>) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        setError("Authentication required to add an address.");
        if (onError) {
          onError("Authentication required to add an address.");
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/addresses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ ...newAddress, createdBy: session.user.id }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            setError("Unauthorized: Please log in again to add address.");
            if (onError) {
              onError("Unauthorized: Please log in again to add address.");
            }
            setUser(null);
          } else {
            setError(`Failed to add address: ${response.statusText}`);
            if (onError) {
              onError(`Failed to add address: ${response.statusText}`);
            }
          }
          return;
        }

        // Address added successfully
        setShowAddForm(false);
        toast({
          title: "Address added successfully!",
          description: "Your new address has been added to your list.",
        });
        // Refetch addresses
        fetchAddresses();
      } catch (err) {
        setError("Error adding address. Please try again.");
        if (onError) {
          onError("Error adding address. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [fetchAddresses, onError, setUser, supabase.auth, toast],
  );

  const handleToggleAddForm = () => {
    setShowAddForm((prev) => !prev);
    setAddressToEdit(null); // Reset edit mode when opening form
  };

  const handleAddressSelection = (addressId: string) => {
    setSelectedAddressId(addressId);
    onAddressSelected(addressId);
  };

  const handleFilterChange = (value: string) => {
    setFilterType(value as "all" | "shared" | "private");
    // Reset to first page when filter changes
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, currentPage: newPage }));
  };

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const getAddressBadge = (address: Address) => {
    if (address.isShared) {
      return <Badge className="ml-1 bg-blue-500">Shared</Badge>;
    }
    if (address.createdBy === user?.id) {
      return <Badge className="ml-1 bg-green-500">Your Address</Badge>;
    }
    return null;
  };

  return (
    <div className="address-manager w-full space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium">{error}</p>
              <p className="mt-1 text-xs text-red-600">
                Please check your input and try again. If the problem persists,
                contact support.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-700 hover:bg-red-100 hover:text-red-900"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => handleFilterChange("all")}
            className={`transition-all duration-200 ease-out ${
              filterType === "all"
                ? "bg-primary text-black hover:bg-primary/90"
                : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            }`}
          >
            All Addresses {addressCounts.all > 0 && `(${addressCounts.all})`}
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
            Your Addresses{" "}
            {addressCounts.private > 0 && `(${addressCounts.private})`}
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
            Shared Addresses{" "}
            {addressCounts.shared > 0 && `(${addressCounts.shared})`}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 animate-pulse">
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <EmptyAddressState
          onAddAddress={handleToggleAddForm}
          filterType={filterType}
        />
      ) : (
        <div className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.isArray(addresses) &&
              addresses.map((address) => (
                <div
                  key={address.id}
                  onClick={() => handleAddressSelection(address.id)}
                  className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Selected indicator */}
                  {selectedAddressId === address.id && (
                    <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <svg
                        className="h-4 w-4 text-black"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-start justify-between pr-8">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {address.name || "Unnamed Location"}
                      </h4>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {address.createdBy === user?.id && (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Your Address
                        </Badge>
                      )}
                      {address.isShared && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          Shared
                        </Badge>
                      )}
                    </div>

                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <p>{address.street1}</p>
                      {address.street2 && (
                        <p className="text-gray-600 dark:text-gray-400">
                          {address.street2}
                        </p>
                      )}
                      <p>
                        {address.city}, {address.state} {address.zip}
                      </p>
                    </div>

                    {/* Additional metadata section */}
                    {(address.county || address.locationNumber || address.parkingLoading) && (
                      <div className="space-y-1 border-t pt-2 text-xs">
                        {address.county && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Info className="h-3 w-3" />
                            <span>
                              <span className="font-medium">County:</span> {address.county}
                            </span>
                          </div>
                        )}
                        {address.locationNumber && (
                          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Phone className="h-3 w-3" />
                            <span>
                              <span className="font-medium">Phone:</span> {address.locationNumber}
                            </span>
                          </div>
                        )}
                        {address.parkingLoading && (
                          <div className="flex items-start gap-1 text-gray-600 dark:text-gray-400">
                            <Info className="mt-0.5 h-3 w-3" />
                            <span>
                              <span className="font-medium">Parking:</span> {address.parkingLoading}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showManagementButtons && (
        <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:space-x-4">
          <Link
            href="/addresses"
            className="rounded-md bg-blue-500 px-4 py-2 text-center text-white transition hover:bg-blue-600 sm:text-left"
          >
            Manage Addresses
          </Link>

          <Button
            onClick={handleToggleAddForm}
            variant={showAddForm ? "destructive" : "default"}
            className={
              showAddForm
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            }
          >
            {showAddForm ? "Cancel" : "Add New Address"}
          </Button>
        </div>
      )}

      {/* Address Modal for Add/Edit */}
      <AddressModal
        isOpen={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setAddressToEdit(null);
        }}
        addressToEdit={addressToEdit}
        onAddressUpdated={() => {
          // Use refreshAddresses to force a fresh fetch without debounce/attempt limits
          refreshAddresses();
          toast({
            title: addressToEdit ? "Address updated successfully!" : "Address added successfully!",
            description: addressToEdit
              ? "Your address has been updated."
              : "Your new address has been added to your list.",
          });
        }}
      />

      {/* Pagination Section */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between border-t bg-slate-50 p-4">
          <Pagination>
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <PaginationPrevious
                  onClick={handlePrevPage}
                  className={`${!pagination.hasPrevPage ? "pointer-events-none opacity-50" : "cursor-pointer hover:bg-slate-200"} text-sm`}
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
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default AddressManager;
