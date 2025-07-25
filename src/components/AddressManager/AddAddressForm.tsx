// src/components/AddressManager/AddAddressForm.tsx

import React, { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressFormData } from "@/types/address";
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData"; // Make sure this import path is correct
import { useToast } from "@/components/ui/use-toast";

// Validation schema with zod
const addressSchema = z.object({
  county: z.string().min(1, { message: "County is required" }),
  name: z.string().optional().nullable(),
  street1: z.string().min(1, { message: "Street address is required" }),
  street2: z.string().optional().nullable(),
  city: z.string().min(1, { message: "City is required" }),
  state: z.string().min(1, { message: "State is required" }),
  zip: z.string().min(5, { message: "Valid ZIP code is required" }),
  locationNumber: z.string().optional().nullable(),
  parkingLoading: z.string().optional().nullable(),
  isRestaurant: z.boolean().default(false),
  isShared: z.boolean().default(false),
});

interface AddAddressFormProps {
  onSubmit: (data: AddressFormData) => Promise<void>;
  onClose: () => void;
  initialValues?: Partial<AddressFormData>;
  allowedCounties?: string[];
}

const AddAddressForm: React.FC<AddAddressFormProps> = ({
  onSubmit,
  onClose,
  initialValues = {},
  allowedCounties,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [availableCounties, setAvailableCounties] = useState<
    Array<{ value: string; label: string }>
  >([...COUNTIES]); // Initialize with all counties as fallback to prevent empty dropdown

  const { toast } = useToast();

  // Set up form with validation
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<z.infer<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      county: initialValues.county || "",
      name: initialValues.name || "",
      street1: initialValues.street1 || "",
      street2: initialValues.street2 || "",
      city: initialValues.city || "",
      state: initialValues.state || "",
      zip: initialValues.zip || "",
      locationNumber: initialValues.locationNumber || "",
      parkingLoading: initialValues.parkingLoading || "",
      isRestaurant: initialValues.isRestaurant || false,
      isShared: initialValues.isShared || false,
    },
  });

  // Set up counties with improved error handling
  useEffect(() => {
    const fetchCounties = async () => {
      // Always ensure we have counties available
      let countiesToUse = [...COUNTIES]; // Default to all counties

      if (allowedCounties && allowedCounties.length > 0) {
        // Filter counties based on allowedCounties prop
        const filteredCounties = COUNTIES.filter((county) =>
          allowedCounties.includes(county.value),
        );

        if (filteredCounties.length > 0) {
          countiesToUse = filteredCounties;
        }
        // If no filtered counties found, fall back to all counties
      } else {
        // Only try API call if no allowedCounties prop is provided
        try {
          const response = await fetch("/api/user-counties");
          if (response.ok) {
            const data = await response.json();
            if (
              data.counties &&
              Array.isArray(data.counties) &&
              data.counties.length > 0
            ) {
              // Filter counties based on API response
              const filteredCounties = COUNTIES.filter((county) =>
                data.counties.includes(county.value),
              );

              if (filteredCounties.length > 0) {
                countiesToUse = filteredCounties;
              }
              // If no filtered counties found, fall back to all counties
            }
          }
        } catch (error) {
          console.error("AddAddressForm: Error fetching counties:", error);
          // API error - fall back to all counties
        }
      }

      // Always set counties, ensuring we have at least the full list
      setAvailableCounties([...countiesToUse]);
    };

    fetchCounties();
  }, [allowedCounties]);

  const submitHandler: SubmitHandler<z.infer<typeof addressSchema>> = async (
    data,
  ) => {
    setIsSubmitting(true);
    setSubmitError(null); // Clear previous errors
    try {
      await onSubmit(data as AddressFormData);
      reset();
      // onSubmit is responsible for closing the dialog on success
    } catch (error) {
      console.error("Error submitting form:", error);
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save address",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle>Add New Address</CardTitle>
        {submitError && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
            <div className="flex">
              <div className="text-sm text-red-600">{submitError}</div>
            </div>
          </div>
        )}
      </CardHeader>
      <div>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* County Field */}
            <div className="space-y-2">
              <Label
                htmlFor="county"
                className={errors.county ? "text-red-500" : ""}
              >
                County <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="county"
                control={control}
                render={({ field }) => {
                  return (
                    <Select
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                    >
                      <SelectTrigger
                        id="county"
                        className={errors.county ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select County" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] max-h-[200px] overflow-y-auto">
                        {availableCounties && availableCounties.length > 0 ? (
                          availableCounties.map((county) => (
                            <SelectItem key={county.value} value={county.value}>
                              {county.label}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            Loading counties...
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              {errors.county && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.county.message}
                </p>
              )}
            </div>

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                placeholder="e.g. Main Office, Downtown Store"
                {...register("name")}
              />
            </div>

            {/* Street Address 1 */}
            <div className="space-y-2">
              <Label
                htmlFor="street1"
                className={errors.street1 ? "text-red-500" : ""}
              >
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="street1"
                placeholder="123 Main St"
                {...register("street1")}
                className={errors.street1 ? "border-red-500" : ""}
              />
              {errors.street1 && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.street1.message}
                </p>
              )}
            </div>

            {/* Street Address 2 */}
            <div className="space-y-2">
              <Label htmlFor="street2">Street Address 2</Label>
              <Input
                id="street2"
                placeholder="Apt 4B, Suite 100, etc."
                {...register("street2")}
              />
            </div>

            {/* City */}
            <div className="space-y-2">
              <Label
                htmlFor="city"
                className={errors.city ? "text-red-500" : ""}
              >
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                id="city"
                placeholder="San Francisco"
                {...register("city")}
                className={errors.city ? "border-red-500" : ""}
              />
              {errors.city && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.city.message}
                </p>
              )}
            </div>

            {/* State */}
            <div className="space-y-2">
              <Label
                htmlFor="state"
                className={errors.state ? "text-red-500" : ""}
              >
                State <span className="text-red-500">*</span>
              </Label>
              <Input
                id="state"
                placeholder="CA"
                {...register("state")}
                className={errors.state ? "border-red-500" : ""}
              />
              {errors.state && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.state.message}
                </p>
              )}
            </div>

            {/* ZIP Code */}
            <div className="space-y-2">
              <Label htmlFor="zip" className={errors.zip ? "text-red-500" : ""}>
                ZIP Code <span className="text-red-500">*</span>
              </Label>
              <Input
                id="zip"
                placeholder="94103"
                {...register("zip")}
                className={errors.zip ? "border-red-500" : ""}
              />
              {errors.zip && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.zip.message}
                </p>
              )}
            </div>

            {/* Location Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="locationNumber">Location Phone Number</Label>
              <Input
                id="locationNumber"
                placeholder="415-555-1234"
                {...register("locationNumber")}
              />
            </div>

            {/* Parking/Loading */}
            <div className="space-y-2">
              <Label htmlFor="parkingLoading">
                Parking / Loading Information
              </Label>
              <Input
                id="parkingLoading"
                placeholder="Parking garage on 2nd floor"
                {...register("parkingLoading")}
              />
            </div>
          </div>

          <div className="flex flex-col space-y-3 pt-4">
            {/* Is Restaurant Checkbox */}
            <div className="flex items-center space-x-2">
              <Controller
                name="isRestaurant"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="isRestaurant"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="isRestaurant" className="cursor-pointer">
                This is a restaurant
              </Label>
            </div>

            {/* Is Shared Checkbox */}
            <div className="flex items-center space-x-2">
              <Controller
                name="isShared"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="isShared"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="isShared" className="cursor-pointer">
                Make this address shared (available to all users)
              </Label>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(submitHandler)()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Address"}
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
};

export default AddAddressForm;
