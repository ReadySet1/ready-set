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
          <DialogTitle>
            {addressToEdit ? "Edit Address" : "Add Address"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="county" className="sm:text-right">
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
                    <SelectTrigger className="sm:col-span-3">
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="name" className="sm:text-right">
                Name
              </Label>
              <Input
                id="name"
                className="sm:col-span-3"
                {...register("name")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="street1" className="sm:text-right">
                Street Address 1
              </Label>
              <Input
                id="street1"
                className="sm:col-span-3"
                {...register("street1")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="street2" className="sm:text-right">
                Street Address 2
              </Label>
              <Input
                id="street2"
                className="sm:col-span-3"
                {...register("street2")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="city" className="sm:text-right">
                City
              </Label>
              <Input
                id="city"
                className="sm:col-span-3"
                {...register("city")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="state" className="sm:text-right">
                State
              </Label>
              <Input
                id="state"
                className="sm:col-span-3"
                {...register("state")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="zip" className="sm:text-right">
                Zip
              </Label>
              <Input id="zip" className="sm:col-span-3" {...register("zip")} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="locationNumber" className="sm:text-right">
                Location Phone Number
              </Label>
              <Input
                id="locationNumber"
                className="sm:col-span-3"
                {...register("locationNumber")}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="parkingLoading" className="sm:text-right">
                Parking / Loading
              </Label>
              <Input
                id="parkingLoading"
                className="sm:col-span-3"
                {...register("parkingLoading")}
              />
            </div>
            <div className="flex items-center space-x-2 sm:col-span-4">
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
              <Label htmlFor="isRestaurant">Is this a restaurant?</Label>
            </div>
            <div className="flex items-center space-x-2 sm:col-span-4">
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
              <Label htmlFor="isShared">Is this a shared address?</Label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">{addressToEdit ? "Update" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddressModal;
