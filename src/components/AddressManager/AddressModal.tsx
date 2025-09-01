import React, { useState, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { COUNTIES } from "@/components/Auth/SignUp/ui/FormData";
import { Address } from "@/types/address";
import { createClient } from "@/utils/supabase/client";

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
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[500px] overflow-y-auto border bg-white shadow-lg dark:bg-gray-950">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            {addressToEdit ? "Edit Address" : "Add Address"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* County Selection */}
          <div className="space-y-2">
            <Label htmlFor="county" className="text-sm font-medium">
              County
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
                    <SelectValue placeholder="Please Select" />
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

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="name"
              className="w-full"
              placeholder="Enter location name"
              {...register("name")}
            />
          </div>

          {/* Street Address 1 */}
          <div className="space-y-2">
            <Label htmlFor="street1" className="text-sm font-medium">
              Street Address 1
            </Label>
            <Input
              id="street1"
              className="w-full"
              placeholder="Enter street address"
              {...register("street1")}
            />
          </div>

          {/* Street Address 2 */}
          <div className="space-y-2">
            <Label htmlFor="street2" className="text-sm font-medium">
              Street Address 2
            </Label>
            <Input
              id="street2"
              className="w-full"
              placeholder="Enter apartment, suite, etc. (optional)"
              {...register("street2")}
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm font-medium">
              City
            </Label>
            <Input
              id="city"
              className="w-full"
              placeholder="Enter city"
              {...register("city")}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label htmlFor="state" className="text-sm font-medium">
              State
            </Label>
            <Input
              id="state"
              className="w-full"
              placeholder="Enter state"
              {...register("state")}
            />
          </div>

          {/* Zip Code */}
          <div className="space-y-2">
            <Label htmlFor="zip" className="text-sm font-medium">
              Zip
            </Label>
            <Input
              id="zip"
              className="w-full"
              placeholder="Enter ZIP code"
              {...register("zip")}
            />
          </div>

          {/* Location Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="locationNumber" className="text-sm font-medium">
              Location Phone Number
            </Label>
            <Input
              id="locationNumber"
              className="w-full"
              placeholder="Enter phone number"
              {...register("locationNumber")}
            />
          </div>

          {/* Parking / Loading */}
          <div className="space-y-2">
            <Label htmlFor="parkingLoading" className="text-sm font-medium">
              Parking / Loading
            </Label>
            <Input
              id="parkingLoading"
              className="w-full"
              placeholder="Enter parking or loading instructions"
              {...register("parkingLoading")}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Controller
                name="isRestaurant"
                control={control}
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox
                    id="isRestaurant"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="isRestaurant" className="text-sm">
                Is this a restaurant?
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Controller
                name="isShared"
                control={control}
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox
                    id="isShared"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="isShared" className="text-sm">
                Is this a shared address?
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-6"
            >
              Cancel
            </Button>
            <Button type="submit" className="px-6">
              {addressToEdit ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressModal;
