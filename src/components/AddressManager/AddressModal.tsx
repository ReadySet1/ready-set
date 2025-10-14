import React, { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { COUNTIES, US_STATES } from "@/components/Auth/SignUp/ui/FormData";
import { Address } from "@/types/address";
import { createClient } from "@/utils/supabase/client";
import { MapPin, Loader2 } from "lucide-react";
import AddressFormSection from "./AddressFormSection";

interface AddressModalProps {
  onAddressUpdated: () => void;
  addressToEdit: Address | null;
  isOpen: boolean;
  onClose: () => void;
}

const AddressModal: React.FC<AddressModalProps> = ({
  onAddressUpdated,
  addressToEdit,
  isOpen,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { control, register, handleSubmit, setValue, reset } =
    useForm<Address>();

  useEffect(() => {
    if (addressToEdit) {
      Object.entries(addressToEdit).forEach(([key, value]) => {
        setValue(key as keyof Address, value);
      });
    } else {
      reset({
        county: "",
        isRestaurant: false,
        isShared: false,
      });
    }
  }, [addressToEdit, setValue, reset]);

  const onSubmit = async (data: Address) => {
    setIsSubmitting(true);
    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Authentication required");
      }

      const url = addressToEdit
        ? `/api/addresses?id=${addressToEdit.id}`
        : "/api/addresses";
      const method = addressToEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...data,
          county: data.county,
          isRestaurant: Boolean(data.isRestaurant),
          isShared: Boolean(data.isShared),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${addressToEdit ? "update" : "add"} address`,
        );
      }

      await response.json();

      reset();
      onAddressUpdated();
      onClose();
    } catch (error) {
      // Error handling - silently fail for now
      // TODO: Add proper error notification to user
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border bg-white shadow-lg dark:bg-gray-950">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl font-semibold">
              {addressToEdit ? "Edit Address" : "Add New Address"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {addressToEdit
              ? "Update the address information below"
              : "Fill in the details to add a new address"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Section 1: Location Details */}
          <AddressFormSection
            title="Location Details"
            description="Specify the county and a friendly name for this address"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="county" className="text-sm font-medium">
                  County <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="county"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select county" />
                      </SelectTrigger>
                      <SelectContent className="z-[1002]">
                        {COUNTIES.map((county) => (
                          <SelectItem key={county.value} value={county.value}>
                            {county.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Address Name
                </Label>
                <Input
                  id="name"
                  className="w-full"
                  placeholder="e.g., Home, Office"
                  {...register("name")}
                />
              </div>
            </div>
          </AddressFormSection>

          {/* Section 2: Address Information */}
          <AddressFormSection
            title="Address Information"
            description="Enter the complete street address"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street1" className="text-sm font-medium">
                  Street Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="street1"
                  className="w-full"
                  placeholder="123 Main St"
                  {...register("street1")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="street2" className="text-sm font-medium">
                  Street Address 2 <span className="text-gray-500">(Optional)</span>
                </Label>
                <Input
                  id="street2"
                  className="w-full"
                  placeholder="Apt, Suite, Unit, etc."
                  {...register("street2")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    className="w-full"
                    placeholder="San Francisco"
                    {...register("city")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium">
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Controller
                    name="state"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="z-[1002] max-h-[300px]">
                          {US_STATES.map((state) => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-sm font-medium">
                    ZIP Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zip"
                    className="w-full"
                    placeholder="94103"
                    {...register("zip")}
                  />
                </div>
              </div>
            </div>
          </AddressFormSection>

          {/* Section 3: Additional Information */}
          <AddressFormSection
            title="Additional Information"
            description="Optional contact and parking details"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="locationNumber" className="text-sm font-medium">
                  Location Phone Number
                </Label>
                <Input
                  id="locationNumber"
                  className="w-full"
                  placeholder="(555) 123-4567"
                  {...register("locationNumber")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parkingLoading" className="text-sm font-medium">
                  Parking / Loading Info
                </Label>
                <Input
                  id="parkingLoading"
                  className="w-full"
                  placeholder="Loading dock at rear"
                  {...register("parkingLoading")}
                />
              </div>
            </div>
          </AddressFormSection>

          {/* Section 4: Options */}
          <AddressFormSection title="Options" description="Configure address settings">
            <div className="space-y-3">
              <div className="flex items-start space-x-3 rounded-lg border p-3">
                <Controller
                  name="isRestaurant"
                  control={control}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      id="isRestaurant"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                  )}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="isRestaurant"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Restaurant Address
                  </Label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Mark this address as a restaurant location
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-3">
                <Controller
                  name="isShared"
                  control={control}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      id="isShared"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1"
                    />
                  )}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="isShared"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Shared Address
                  </Label>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Make this address available to all users in your organization
                  </p>
                </div>
              </div>
            </div>
          </AddressFormSection>

          {/* Sticky Footer with Action Buttons */}
          <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-3 border-t bg-white px-6 py-4 dark:bg-gray-950">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px] px-6"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{addressToEdit ? "Update" : "Save"}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressModal;
