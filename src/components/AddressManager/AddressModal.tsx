import React, { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Spinner } from "@/components/ui/spinner";
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData";
import { Address } from "@/types/address";
import { createClient } from "@/utils/supabase/client";
import AddressFormSection from "./AddressFormSection";
import { MapPin, Building2, Phone, Car, Settings2 } from "lucide-react";

// Validation schema
const addressSchema = z.object({
  county: z.string().min(1, "County is required"),
  name: z.string().optional().nullable(),
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zip: z.string().min(5, "Valid ZIP code is required"),
  locationNumber: z.string().optional().nullable(),
  parkingLoading: z.string().optional().nullable(),
  isRestaurant: z.boolean().default(false),
  isShared: z.boolean().default(false),
});

interface AddressModalProps {
  onAddressUpdated: () => void;
  addressToEdit: Address | null;
  isOpen: boolean;
  onClose: () => void;
}

type AddressFormData = z.infer<typeof addressSchema>;

const AddressModal: React.FC<AddressModalProps> = ({
  onAddressUpdated,
  addressToEdit,
  isOpen,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      county: "",
      name: "",
      street1: "",
      street2: "",
      city: "",
      state: "",
      zip: "",
      locationNumber: "",
      parkingLoading: "",
      isRestaurant: false,
      isShared: false,
    },
  });

  useEffect(() => {
    if (addressToEdit) {
      Object.entries(addressToEdit).forEach(([key, value]) => {
        if (key in addressSchema.shape) {
          setValue(key as keyof AddressFormData, value);
        }
      });
    } else {
      reset({
        county: "",
        name: "",
        street1: "",
        street2: "",
        city: "",
        state: "",
        zip: "",
        locationNumber: "",
        parkingLoading: "",
        isRestaurant: false,
        isShared: false,
      });
    }
    setSubmitError(null);
  }, [addressToEdit, setValue, reset, isOpen]);

  const onSubmit = async (data: AddressFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Authentication required. Please sign in again.");
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to ${addressToEdit ? "update" : "add"} address`,
        );
      }

      const updatedAddress = await response.json();
      console.log(
        `Address ${addressToEdit ? "updated" : "added"}:`,
        updatedAddress,
      );

      reset();
      onAddressUpdated();
      onClose();
    } catch (error) {
      console.error(
        `Error ${addressToEdit ? "updating" : "adding"} address:`,
        error,
      );
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto border bg-white shadow-lg dark:bg-gray-950">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl font-semibold">
              {addressToEdit ? "Edit Address" : "Add New Address"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            {addressToEdit
              ? "Update the details for this address"
              : "Fill in the information below to create a new address"}
          </DialogDescription>
        </DialogHeader>

        {/* Error Message */}
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1: Location Details */}
          <AddressFormSection
            title="Location Details"
            description="Select the county and give this location a name"
            icon={<MapPin className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* County Selection */}
              <div className="space-y-2">
                <Label
                  htmlFor="county"
                  className={`text-sm font-medium ${errors.county ? "text-red-500" : ""}`}
                >
                  County <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="county"
                  control={control}
                  render={({ field }) => (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger
                        className={`w-full ${errors.county ? "border-red-500" : ""}`}
                      >
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
                {errors.county && (
                  <p className="text-xs text-red-500">
                    {errors.county.message}
                  </p>
                )}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Location Name
                </Label>
                <Input
                  id="name"
                  className="w-full"
                  placeholder="e.g., Home, Office, etc."
                  disabled={isSubmitting}
                  {...register("name")}
                />
                <p className="text-xs text-gray-500">Optional friendly name</p>
              </div>
            </div>
          </AddressFormSection>

          {/* Section 2: Address Information */}
          <AddressFormSection
            title="Address Information"
            description="Enter the complete street address"
            icon={<Building2 className="h-4 w-4" />}
          >
            <div className="space-y-4">
              {/* Street Address 1 */}
              <div className="space-y-2">
                <Label
                  htmlFor="street1"
                  className={`text-sm font-medium ${errors.street1 ? "text-red-500" : ""}`}
                >
                  Street Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="street1"
                  className={`w-full ${errors.street1 ? "border-red-500" : ""}`}
                  placeholder="123 Main Street"
                  disabled={isSubmitting}
                  {...register("street1")}
                />
                {errors.street1 && (
                  <p className="text-xs text-red-500">
                    {errors.street1.message}
                  </p>
                )}
              </div>

              {/* Street Address 2 */}
              <div className="space-y-2">
                <Label htmlFor="street2" className="text-sm font-medium">
                  Apartment, Suite, etc.
                </Label>
                <Input
                  id="street2"
                  className="w-full"
                  placeholder="Apt 4B, Suite 200, etc. (optional)"
                  disabled={isSubmitting}
                  {...register("street2")}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* City */}
                <div className="space-y-2">
                  <Label
                    htmlFor="city"
                    className={`text-sm font-medium ${errors.city ? "text-red-500" : ""}`}
                  >
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    className={`w-full ${errors.city ? "border-red-500" : ""}`}
                    placeholder="San Francisco"
                    disabled={isSubmitting}
                    {...register("city")}
                  />
                  {errors.city && (
                    <p className="text-xs text-red-500">
                      {errors.city.message}
                    </p>
                  )}
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label
                    htmlFor="state"
                    className={`text-sm font-medium ${errors.state ? "text-red-500" : ""}`}
                  >
                    State <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="state"
                    className={`w-full ${errors.state ? "border-red-500" : ""}`}
                    placeholder="CA"
                    disabled={isSubmitting}
                    {...register("state")}
                  />
                  {errors.state && (
                    <p className="text-xs text-red-500">
                      {errors.state.message}
                    </p>
                  )}
                </div>

                {/* Zip Code */}
                <div className="space-y-2">
                  <Label
                    htmlFor="zip"
                    className={`text-sm font-medium ${errors.zip ? "text-red-500" : ""}`}
                  >
                    ZIP Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zip"
                    className={`w-full ${errors.zip ? "border-red-500" : ""}`}
                    placeholder="94103"
                    disabled={isSubmitting}
                    {...register("zip")}
                  />
                  {errors.zip && (
                    <p className="text-xs text-red-500">{errors.zip.message}</p>
                  )}
                </div>
              </div>
            </div>
          </AddressFormSection>

          {/* Section 3: Additional Information */}
          <AddressFormSection
            title="Additional Information"
            description="Optional contact and delivery details"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Location Phone Number */}
              <div className="space-y-2">
                <Label
                  htmlFor="locationNumber"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Phone className="h-3 w-3" />
                  Phone Number
                </Label>
                <Input
                  id="locationNumber"
                  className="w-full"
                  placeholder="(555) 123-4567"
                  disabled={isSubmitting}
                  {...register("locationNumber")}
                />
              </div>

              {/* Parking / Loading */}
              <div className="space-y-2">
                <Label
                  htmlFor="parkingLoading"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Car className="h-3 w-3" />
                  Parking / Loading
                </Label>
                <Input
                  id="parkingLoading"
                  className="w-full"
                  placeholder="Loading dock, street parking, etc."
                  disabled={isSubmitting}
                  {...register("parkingLoading")}
                />
              </div>
            </div>
          </AddressFormSection>

          {/* Section 4: Options */}
          <AddressFormSection
            title="Options"
            description="Select address type and sharing preferences"
            icon={<Settings2 className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <div className="flex items-start space-x-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <Controller
                  name="isRestaurant"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="isRestaurant"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                  )}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="isRestaurant"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Restaurant Location
                  </Label>
                  <p className="mt-1 text-xs text-gray-500">
                    Check this if this address is a restaurant or food
                    establishment
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
                <Controller
                  name="isShared"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="isShared"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                      className="mt-0.5"
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
                  <p className="mt-1 text-xs text-gray-500">
                    Make this address available to all users in your
                    organization
                  </p>
                </div>
              </div>
            </div>
          </AddressFormSection>

          {/* Action Buttons - Sticky Footer */}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-white pt-4 dark:border-gray-700 dark:bg-gray-950">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Saving...
                </div>
              ) : (
                <span>{addressToEdit ? "Update Address" : "Save Address"}</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressModal;
