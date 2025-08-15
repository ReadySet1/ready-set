// src/components/AddressManager/UserAddresses.tsx

import React, { useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Address } from "@/types/address";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import AddressModal from "./AddressModal";

const UserAddresses: React.FC = () => {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [addressToEdit, setAddressToEdit] = useState<Address | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "shared" | "private">(
    "all",
  );
  const [deleteConfirmAddress, setDeleteConfirmAddress] =
    useState<Address | null>(null);
  const router = useRouter();

  // Initialize Supabase client and auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = await createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        setUser(user);

        // Set up auth listener
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "SIGNED_IN") {
              setUser(session?.user || null);
            } else if (event === "SIGNED_OUT") {
              setUser(null);
              router.push("/sign-in");
            }
          },
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Auth error:", error);
        setError("Authentication error. Please sign in again.");
        setIsLoading(false);
      }
    };

    initAuth();
  }, [router]);

  // Fetch addresses based on filter
  const fetchAddresses = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current session for authentication
      const supabase = await createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Authentication required. Please sign in again.");
      }

      const response = await fetch(`/api/addresses?filter=${filterType}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(
        `Fetched ${data.length} addresses for user ${user.id} with filter "${filterType}"`,
      );
      setAddresses(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error fetching addresses:", errorMessage);
      setError(`Failed to load addresses: ${errorMessage}`);

      // If it's an auth error, redirect to sign-in
      if (
        errorMessage.includes("Authentication") ||
        errorMessage.includes("Session expired")
      ) {
        router.push("/sign-in");
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, filterType, router]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user, filterType, fetchAddresses]);

  const handleDeleteAddress = async (addressId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current session for authentication
      const supabase = await createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Authentication required. Please sign in again.");
      }

      const response = await fetch(`/api/addresses?id=${addressId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete address");
      }

      // Update the local state to remove the deleted address
      setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
      setDeleteConfirmAddress(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error deleting address:", errorMessage);
      setError(`Failed to delete address: ${errorMessage}`);

      // If it's an auth error, redirect to sign-in
      if (
        errorMessage.includes("Authentication") ||
        errorMessage.includes("Session expired")
      ) {
        router.push("/sign-in");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressUpdated = useCallback(() => {
    fetchAddresses();
    setAddressToEdit(null);
    setIsModalOpen(false);
  }, [fetchAddresses]);

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
        <Button className="mt-4" onClick={() => router.push("/sign-in")}>
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
            onValueChange={(value) => setFilterType(value as any)}
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
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-500">
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-2 h-auto p-1 text-red-700"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Content Area */}
      <div>
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
