// src/components/Orders/ui/EditOrderDialog.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { utcToLocalTime, setZonedTime, setZonedDate, zonedCalendarDay } from "@/lib/utils/timezone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDateTimeForDisplay } from "@/lib/utils/date-display";
import {
  Edit3,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle,
  Package,
  Users,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { Order, OrderType, VehicleType } from "@/types/order";
import {
  buildOrderUpdatePayload,
  editOrderSchema,
  EditOrderFormData,
  EditOrderFormInput,
  toOrderFormValues,
} from "./edit-order-form";

interface EditOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSaveSuccess: () => void;
}

const EditOrderDialog: React.FC<EditOrderDialogProps> = ({
  isOpen,
  onOpenChange,
  order,
  onSaveSuccess,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");
  const supabase = createClient();

  const isCatering = order.order_type === "catering";
  const orderTypeLabel = isCatering ? "Catering" : "On-Demand";

  // Inputs hold the raw typed text; the resolver hands onSubmit parsed numbers.
  const form = useForm<EditOrderFormInput, unknown, EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: toOrderFormValues(order),
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = form;

  // Handle form validation errors
  const onFormError = (formErrors: typeof errors) => {
    console.error("Form validation errors:", formErrors);
    const firstError = Object.entries(formErrors)[0];
    if (firstError) {
      const [field, error] = firstError;
      toast.error(`Validation error in ${field}: ${(error as any)?.message || 'Invalid value'}`);
    }
  };

  // Reset form when order changes
  useEffect(() => {
    if (isOpen && order) {
      form.reset(toOrderFormValues(order));
    }
  }, [isOpen, order, form]);

  const onSubmit = async (data: EditOrderFormData) => {
    setIsSaving(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error("Authentication error. Please try logging in again.");
        return;
      }

      // Build the update payload - only include changed fields
      const updatePayload = buildOrderUpdatePayload(data, order);

      // Check if there are any changes
      if (Object.keys(updatePayload).length === 0) {
        toast.success("No changes to save");
        onOpenChange(false);
        return;
      }

      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(updatePayload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update order: ${response.status}`);
      }

      toast.success("Order updated successfully!");
      onSaveSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update order");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to render datetime picker
  const renderDateTimePicker = (
    fieldName: "pickupDateTime" | "arrivalDateTime",
    label: string
  ) => {
    const value = watch(fieldName);

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Popover modal={false}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full h-11 justify-start text-left font-normal",
                !value && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? formatDateTimeForDisplay(value, "PPPp") : "Select date and time"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[1100] w-auto p-0" align="start" sideOffset={4}>
            <Calendar
              mode="single"
              selected={value ? zonedCalendarDay(value) : undefined}
              defaultMonth={value ? zonedCalendarDay(value) : undefined}
              onSelect={(day) => {
                if (!day) {
                  setValue(fieldName, null, { shouldDirty: true });
                  return;
                }
                setValue(
                  fieldName,
                  setZonedDate(watch(fieldName) ?? null, format(day, "yyyy-MM-dd")),
                  { shouldDirty: true },
                );
              }}
              captionLayout="dropdown"
              disabled={(day) =>
                format(day, "yyyy-MM-dd") < utcToLocalTime(new Date()).date
              }
            />
            <div className="border-t p-4">
              <div className="flex items-center gap-4">
                <Label className="min-w-fit">Time (PT)</Label>
                <Input
                  type="time"
                  className="w-full"
                  value={value ? utcToLocalTime(value).time : ""}
                  onChange={(e) => {
                    const timeValue = e.target.value;
                    if (!/^\d{2}:\d{2}$/.test(timeValue)) return;
                    setValue(
                      fieldName,
                      setZonedTime(watch(fieldName) ?? new Date(), timeValue),
                      { shouldDirty: true },
                    );
                  }}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-amber-50 via-primary/10 to-white px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Edit3 className="h-5 w-5 text-primary" />
            Edit {orderTypeLabel} Order
          </DialogTitle>
          <DialogDescription>
            Order #{order.orderNumber} - Make changes to the order details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onFormError)}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-6">
              <TabsList className="h-12 w-full justify-start gap-2 bg-transparent p-0">
                <TabsTrigger
                  value="schedule"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  {isCatering ? <Users className="mr-2 h-4 w-4" /> : <Package className="mr-2 h-4 w-4" />}
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="addresses"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Addresses
                </TabsTrigger>
                <TabsTrigger
                  value="pricing"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="h-[50vh] px-6 py-4">
              {/* Schedule Tab */}
              <TabsContent value="schedule" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDateTimePicker("pickupDateTime", "Pickup Date & Time")}
                  {renderDateTimePicker("arrivalDateTime", "Arrival Date & Time")}
                </div>
              </TabsContent>

              {/* Details Tab - Type Specific */}
              <TabsContent value="details" className="mt-0 space-y-4">
                {isCatering ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="brokerage">Brokerage</Label>
                        <Input
                          id="brokerage"
                          {...register("brokerage")}
                          placeholder="Enter brokerage"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="headcount">Headcount</Label>
                        <Input
                          id="headcount"
                          type="number"
                          {...register("headcount")}
                          placeholder="Enter headcount"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="needHost">Need Host</Label>
                        <Select
                          value={watch("needHost") || "NO"}
                          onValueChange={(value) => setValue("needHost", value as "YES" | "NO", { shouldDirty: true })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="YES">Yes</SelectItem>
                            <SelectItem value="NO">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hoursNeeded">Hours Needed</Label>
                        <Input
                          id="hoursNeeded"
                          type="number"
                          step="0.5"
                          {...register("hoursNeeded")}
                          placeholder="Hours"
                          disabled={watch("needHost") === "NO"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numberOfHosts">Number of Hosts</Label>
                        <Input
                          id="numberOfHosts"
                          type="number"
                          {...register("numberOfHosts")}
                          placeholder="Hosts"
                          disabled={watch("needHost") === "NO"}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="itemDelivered">Item Delivered</Label>
                        <Input
                          id="itemDelivered"
                          {...register("itemDelivered")}
                          placeholder="Describe the item"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleType">Vehicle Type</Label>
                        <Select
                          value={watch("vehicleType") || "CAR"}
                          onValueChange={(value) => setValue("vehicleType", value as "CAR" | "VAN" | "TRUCK", { shouldDirty: true })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CAR">Car</SelectItem>
                            <SelectItem value="VAN">Van</SelectItem>
                            <SelectItem value="TRUCK">Truck</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Package Dimensions</Label>
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label htmlFor="length" className="text-xs text-muted-foreground">Length</Label>
                          <Input
                            id="length"
                            type="number"
                            step="0.01"
                            {...register("length")}
                            placeholder="L"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="width" className="text-xs text-muted-foreground">Width</Label>
                          <Input
                            id="width"
                            type="number"
                            step="0.01"
                            {...register("width")}
                            placeholder="W"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="height" className="text-xs text-muted-foreground">Height</Label>
                          <Input
                            id="height"
                            type="number"
                            step="0.01"
                            {...register("height")}
                            placeholder="H"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="weight" className="text-xs text-muted-foreground">Weight (lbs)</Label>
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            {...register("weight")}
                            placeholder="Weight"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Addresses Tab */}
              <TabsContent value="addresses" className="mt-0 space-y-6">
                {/* Pickup Address */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-700">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    Pickup Address
                  </h3>
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.street1">Street Address</Label>
                        <Input
                          id="pickupAddress.street1"
                          {...register("pickupAddress.street1")}
                          placeholder="Street address"
                        />
                        {errors.pickupAddress?.street1 && (
                          <p className="text-sm text-red-500">{errors.pickupAddress.street1.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.street2">Suite/Unit (optional)</Label>
                        <Input
                          id="pickupAddress.street2"
                          {...register("pickupAddress.street2")}
                          placeholder="Suite, unit, etc."
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.city">City</Label>
                        <Input
                          id="pickupAddress.city"
                          {...register("pickupAddress.city")}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.state">State</Label>
                        <Input
                          id="pickupAddress.state"
                          {...register("pickupAddress.state")}
                          placeholder="CA"
                          maxLength={2}
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.zip">ZIP Code</Label>
                        <Input
                          id="pickupAddress.zip"
                          {...register("pickupAddress.zip")}
                          placeholder="12345"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.locationNumber">Location/Suite # (optional)</Label>
                        <Input
                          id="pickupAddress.locationNumber"
                          {...register("pickupAddress.locationNumber")}
                          placeholder="Location number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pickupAddress.parkingLoading">Parking/Loading Info (optional)</Label>
                        <Input
                          id="pickupAddress.parkingLoading"
                          {...register("pickupAddress.parkingLoading")}
                          placeholder="Parking instructions"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-700">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    Delivery Address
                  </h3>
                  <div className="grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.street1">Street Address</Label>
                        <Input
                          id="deliveryAddress.street1"
                          {...register("deliveryAddress.street1")}
                          placeholder="Street address"
                        />
                        {errors.deliveryAddress?.street1 && (
                          <p className="text-sm text-red-500">{errors.deliveryAddress.street1.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.street2">Suite/Unit (optional)</Label>
                        <Input
                          id="deliveryAddress.street2"
                          {...register("deliveryAddress.street2")}
                          placeholder="Suite, unit, etc."
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.city">City</Label>
                        <Input
                          id="deliveryAddress.city"
                          {...register("deliveryAddress.city")}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.state">State</Label>
                        <Input
                          id="deliveryAddress.state"
                          {...register("deliveryAddress.state")}
                          placeholder="CA"
                          maxLength={2}
                          className="uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.zip">ZIP Code</Label>
                        <Input
                          id="deliveryAddress.zip"
                          {...register("deliveryAddress.zip")}
                          placeholder="12345"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.locationNumber">Location/Suite # (optional)</Label>
                        <Input
                          id="deliveryAddress.locationNumber"
                          {...register("deliveryAddress.locationNumber")}
                          placeholder="Location number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress.parkingLoading">Parking/Loading Info (optional)</Label>
                        <Input
                          id="deliveryAddress.parkingLoading"
                          {...register("deliveryAddress.parkingLoading")}
                          placeholder="Parking instructions"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Pricing Tab */}
              <TabsContent value="pricing" className="mt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orderTotal">Order Total ($)</Label>
                    <Input
                      id="orderTotal"
                      type="number"
                      step="0.01"
                      {...register("orderTotal")}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tip">Tip ($)</Label>
                    <Input
                      id="tip"
                      type="number"
                      step="0.01"
                      {...register("tip")}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {isCatering && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="appliedDiscount">Applied Discount ($)</Label>
                      <Input
                        id="appliedDiscount"
                        type="number"
                        step="0.01"
                        {...register("appliedDiscount")}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryCost">Delivery Cost ($)</Label>
                      <Input
                        id="deliveryCost"
                        type="number"
                        step="0.01"
                        {...register("deliveryCost")}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientAttention">Client Attention / Contact Name</Label>
                  <Input
                    id="clientAttention"
                    {...register("clientAttention")}
                    placeholder="Person to contact on arrival"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pickupNotes">Pickup Notes</Label>
                  <Textarea
                    id="pickupNotes"
                    {...register("pickupNotes")}
                    placeholder="Special instructions for pickup..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialNotes">Special Notes</Label>
                  <Textarea
                    id="specialNotes"
                    {...register("specialNotes")}
                    placeholder="Any additional notes or instructions..."
                    rows={3}
                  />
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="border-t bg-slate-50 px-6 py-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {isDirty && (
                  <>
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span>You have unsaved changes</span>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !isDirty}
                  className="bg-gradient-to-r from-primary to-custom-yellow text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;
