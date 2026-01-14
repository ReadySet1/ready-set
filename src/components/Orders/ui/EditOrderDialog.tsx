// src/components/Orders/ui/EditOrderDialog.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
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

// Form schema for the edit dialog - permissive validation, server will validate strictly
const editOrderSchema = z.object({
  // Schedule
  pickupDateTime: z.date().optional().nullable(),
  arrivalDateTime: z.date().optional().nullable(),

  // Catering specific
  brokerage: z.string().optional().nullable(),
  headcount: z.number().int().positive().optional().nullable(),
  needHost: z.enum(["YES", "NO"]).optional(),
  hoursNeeded: z.number().positive().optional().nullable(),
  numberOfHosts: z.number().int().positive().optional().nullable(),

  // On-demand specific
  itemDelivered: z.string().optional().nullable(),
  vehicleType: z.enum(["CAR", "VAN", "TRUCK"]).optional(),
  length: z.number().positive().optional().nullable(),
  width: z.number().positive().optional().nullable(),
  height: z.number().positive().optional().nullable(),
  weight: z.number().positive().optional().nullable(),

  // Pricing
  orderTotal: z.number().nonnegative().optional().nullable(),
  tip: z.number().nonnegative().optional().nullable(),
  appliedDiscount: z.number().nonnegative().optional().nullable(),
  deliveryCost: z.number().nonnegative().optional().nullable(),

  // Notes
  clientAttention: z.string().optional().nullable(),
  pickupNotes: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),

  // Addresses - permissive validation, server validates strictly
  pickupAddress: z.object({
    street1: z.string(),
    street2: z.string().optional().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    county: z.string().optional().nullable(),
    locationNumber: z.string().optional().nullable(),
    parkingLoading: z.string().optional().nullable(),
  }).optional(),
  deliveryAddress: z.object({
    street1: z.string(),
    street2: z.string().optional().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    county: z.string().optional().nullable(),
    locationNumber: z.string().optional().nullable(),
    parkingLoading: z.string().optional().nullable(),
  }).optional(),
});

type EditOrderFormData = z.infer<typeof editOrderSchema>;

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

  // Parse date strings to Date objects
  const parseDateTime = (value: string | Date | null | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const form = useForm<EditOrderFormData>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      pickupDateTime: parseDateTime(order.pickupDateTime),
      arrivalDateTime: parseDateTime(order.arrivalDateTime),
      brokerage: (order as any).brokerage ?? null,
      headcount: (order as any).headcount ?? null,
      needHost: (order as any).needHost ?? "NO",
      hoursNeeded: (order as any).hoursNeeded ?? null,
      numberOfHosts: (order as any).numberOfHosts ?? null,
      itemDelivered: (order as any).itemDelivered ?? null,
      vehicleType: (order as any).vehicleType ?? "CAR",
      length: (order as any).length ?? null,
      width: (order as any).width ?? null,
      height: (order as any).height ?? null,
      weight: (order as any).weight ?? null,
      orderTotal: order.orderTotal ? Number(order.orderTotal) : null,
      tip: order.tip ? Number(order.tip) : null,
      appliedDiscount: (order as any).appliedDiscount ? Number((order as any).appliedDiscount) : null,
      deliveryCost: (order as any).deliveryCost ? Number((order as any).deliveryCost) : null,
      clientAttention: order.clientAttention ?? null,
      pickupNotes: order.pickupNotes ?? null,
      specialNotes: order.specialNotes ?? null,
      pickupAddress: order.pickupAddress ? {
        street1: order.pickupAddress.street1 ?? "",
        street2: order.pickupAddress.street2 ?? null,
        city: order.pickupAddress.city ?? "",
        state: order.pickupAddress.state ?? "",
        zip: order.pickupAddress.zip ?? "",
        county: order.pickupAddress.county ?? null,
        locationNumber: order.pickupAddress.locationNumber ?? null,
        parkingLoading: order.pickupAddress.parkingLoading ?? null,
      } : undefined,
      deliveryAddress: order.deliveryAddress ? {
        street1: order.deliveryAddress.street1 ?? "",
        street2: order.deliveryAddress.street2 ?? null,
        city: order.deliveryAddress.city ?? "",
        state: order.deliveryAddress.state ?? "",
        zip: order.deliveryAddress.zip ?? "",
        county: order.deliveryAddress.county ?? null,
        locationNumber: order.deliveryAddress.locationNumber ?? null,
        parkingLoading: order.deliveryAddress.parkingLoading ?? null,
      } : undefined,
    },
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
      form.reset({
        pickupDateTime: parseDateTime(order.pickupDateTime),
        arrivalDateTime: parseDateTime(order.arrivalDateTime),
        brokerage: (order as any).brokerage ?? null,
        headcount: (order as any).headcount ?? null,
        needHost: (order as any).needHost ?? "NO",
        hoursNeeded: (order as any).hoursNeeded ?? null,
        numberOfHosts: (order as any).numberOfHosts ?? null,
        itemDelivered: (order as any).itemDelivered ?? null,
        vehicleType: (order as any).vehicleType ?? "CAR",
        length: (order as any).length ?? null,
        width: (order as any).width ?? null,
        height: (order as any).height ?? null,
        weight: (order as any).weight ?? null,
        orderTotal: order.orderTotal ? Number(order.orderTotal) : null,
        tip: order.tip ? Number(order.tip) : null,
        appliedDiscount: (order as any).appliedDiscount ? Number((order as any).appliedDiscount) : null,
        deliveryCost: (order as any).deliveryCost ? Number((order as any).deliveryCost) : null,
        clientAttention: order.clientAttention ?? null,
        pickupNotes: order.pickupNotes ?? null,
        specialNotes: order.specialNotes ?? null,
        pickupAddress: order.pickupAddress ? {
          street1: order.pickupAddress.street1 ?? "",
          street2: order.pickupAddress.street2 ?? null,
          city: order.pickupAddress.city ?? "",
          state: order.pickupAddress.state ?? "",
          zip: order.pickupAddress.zip ?? "",
          county: order.pickupAddress.county ?? null,
          locationNumber: order.pickupAddress.locationNumber ?? null,
          parkingLoading: order.pickupAddress.parkingLoading ?? null,
        } : undefined,
        deliveryAddress: order.deliveryAddress ? {
          street1: order.deliveryAddress.street1 ?? "",
          street2: order.deliveryAddress.street2 ?? null,
          city: order.deliveryAddress.city ?? "",
          state: order.deliveryAddress.state ?? "",
          zip: order.deliveryAddress.zip ?? "",
          county: order.deliveryAddress.county ?? null,
          locationNumber: order.deliveryAddress.locationNumber ?? null,
          parkingLoading: order.deliveryAddress.parkingLoading ?? null,
        } : undefined,
      });
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
      const updatePayload: Record<string, unknown> = {};

      // Compare and add changed fields
      if (data.pickupDateTime !== parseDateTime(order.pickupDateTime)) {
        updatePayload.pickupDateTime = data.pickupDateTime?.toISOString();
      }
      if (data.arrivalDateTime !== parseDateTime(order.arrivalDateTime)) {
        updatePayload.arrivalDateTime = data.arrivalDateTime?.toISOString();
      }

      // Add type-specific fields
      if (isCatering) {
        if (data.brokerage !== (order as any).brokerage) updatePayload.brokerage = data.brokerage;
        if (data.headcount !== (order as any).headcount) updatePayload.headcount = data.headcount;
        if (data.needHost !== (order as any).needHost) updatePayload.needHost = data.needHost;
        if (data.hoursNeeded !== (order as any).hoursNeeded) updatePayload.hoursNeeded = data.hoursNeeded;
        if (data.numberOfHosts !== (order as any).numberOfHosts) updatePayload.numberOfHosts = data.numberOfHosts;
        if (data.appliedDiscount !== Number((order as any).appliedDiscount || 0)) updatePayload.appliedDiscount = data.appliedDiscount;
        if (data.deliveryCost !== Number((order as any).deliveryCost || 0)) updatePayload.deliveryCost = data.deliveryCost;
      } else {
        if (data.itemDelivered !== (order as any).itemDelivered) updatePayload.itemDelivered = data.itemDelivered;
        if (data.vehicleType !== (order as any).vehicleType) updatePayload.vehicleType = data.vehicleType;
        if (data.length !== (order as any).length) updatePayload.length = data.length;
        if (data.width !== (order as any).width) updatePayload.width = data.width;
        if (data.height !== (order as any).height) updatePayload.height = data.height;
        if (data.weight !== (order as any).weight) updatePayload.weight = data.weight;
      }

      // Common pricing fields
      if (data.orderTotal !== Number(order.orderTotal || 0)) updatePayload.orderTotal = data.orderTotal;
      if (data.tip !== Number(order.tip || 0)) updatePayload.tip = data.tip;

      // Notes
      if (data.clientAttention !== order.clientAttention) updatePayload.clientAttention = data.clientAttention;
      if (data.pickupNotes !== order.pickupNotes) updatePayload.pickupNotes = data.pickupNotes;
      if (data.specialNotes !== order.specialNotes) updatePayload.specialNotes = data.specialNotes;

      // Addresses - always include if form has data
      if (data.pickupAddress) {
        updatePayload.pickupAddress = data.pickupAddress;
      }
      if (data.deliveryAddress) {
        updatePayload.deliveryAddress = data.deliveryAddress;
      }

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
              {value ? format(value, "PPPp") : "Select date and time"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[1100] w-auto p-0" align="start" sideOffset={4}>
            <Calendar
              mode="single"
              selected={value || undefined}
              onSelect={(date) => {
                if (!date) {
                  setValue(fieldName, null);
                  return;
                }
                const currentValue = watch(fieldName);
                const newDate = new Date(date);
                if (currentValue) {
                  newDate.setHours(currentValue.getHours(), currentValue.getMinutes(), 0, 0);
                } else {
                  newDate.setHours(12, 0, 0, 0);
                }
                setValue(fieldName, newDate, { shouldDirty: true });
              }}
              captionLayout="dropdown"
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
            <div className="border-t p-4">
              <div className="flex items-center gap-4">
                <Label className="min-w-fit">Time</Label>
                <Input
                  type="time"
                  className="w-full"
                  value={value ? format(value, "HH:mm") : ""}
                  onChange={(e) => {
                    const timeValue = e.target.value;
                    if (!timeValue || !timeValue.includes(":")) return;
                    const parts = timeValue.split(":");
                    const hours = parseInt(parts[0] ?? "0", 10);
                    const minutes = parseInt(parts[1] ?? "0", 10);
                    if (isNaN(hours) || isNaN(minutes)) return;
                    const currentDate = watch(fieldName) || new Date();
                    const newDate = new Date(currentDate);
                    newDate.setHours(hours, minutes, 0, 0);
                    setValue(fieldName, newDate, { shouldDirty: true });
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
