// Admin Side - Create On-Demand Order Form

"use client";

import React, {
  useState,
  useEffect,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createOnDemandOrder } from "@/app/(backend)/admin/on-demand-orders/_actions/on-demand-orders";
import {
  createOnDemandOrderSchema,
  CreateOnDemandOrderInput,
  ClientListItem,
} from "@/app/(backend)/admin/on-demand-orders/_actions/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CalendarIcon,
  Loader2,
  Check,
  ChevronsUpDown,
  X,
  AlertCircle,
  ChevronDown,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressSelector } from "@/components/AddressSelector";
import { Address, AddressFormData } from "@/types/address";
import { createClient } from "@/utils/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useUploadFile, UploadedFile } from "@/hooks/use-upload-file";
import { FileWithPath } from "react-dropzone";

interface CreateOnDemandOrderFormProps {
  clients?: ClientListItem[]; // Optional when preSelectedUserId is provided
  preSelectedUserId?: string; // For client-facing form
}

// Client-side form values type (uses Date objects, not serialized strings)
interface FormValues {
  userId: string;
  clientAttention: string;
  pickupDateTime?: Date;
  arrivalDateTime?: Date;
  completeDateTime?: Date | null;
  vehicleType: "CAR" | "VAN" | "TRUCK";
  pickupAddress: {
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    county?: string | null;
  };
  deliveryAddress: {
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    county?: string | null;
  };
  orderNumber?: string;
  tempEntityId?: string;
  hoursNeeded?: number | null;
  itemDelivered?: string | null;
  pickupNotes?: string | null;
  specialNotes?: string | null;
  orderTotal?: number | null;
  tip?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
}
// Vehicle type options
const VEHICLE_TYPE_OPTIONS = [
  { value: "CAR", label: "Car" },
  { value: "VAN", label: "Van" },
  { value: "TRUCK", label: "Truck" },
];

export const CreateOnDemandOrderForm: React.FC<CreateOnDemandOrderFormProps> = ({
  clients,
  preSelectedUserId,
}) => {
  const router = useRouter();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);

  // File upload state
  const [uploadedFileKeys, setUploadedFileKeys] = useState<string[]>([]);

  // Initialize Supabase client
  const supabase = createClient();

  // Get and store the session for userId in useUploadFile
  const [session, setSession] = useState<Session | null>(null);

  // Track selected address IDs for visual feedback
  const [selectedPickupAddressId, setSelectedPickupAddressId] = useState<string | undefined>();
  const [selectedDeliveryAddressId, setSelectedDeliveryAddressId] = useState<string | undefined>();

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    };
    getSession();
  }, [supabase.auth]);

  // Initialize file upload hook
  const {
    onUpload,
    uploadedFiles,
    progresses,
    isUploading,
    tempEntityId,
    updateEntityId,
    deleteFile,
  } = useUploadFile({
    bucketName: "fileUploader",
    maxFileCount: 5,
    maxFileSize: 10 * 1024 * 1024,
    allowedFileTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    category: "on-demand",
    entityType: "on_demand",
    userId: session?.user?.id,
  });

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createOnDemandOrderSchema) as any,
    defaultValues: {
      vehicleType: "CAR",
      pickupAddress: { street1: "", city: "", state: "", zip: "" },
      deliveryAddress: { street1: "", city: "", state: "", zip: "" },
      pickupDateTime: undefined,
      arrivalDateTime: undefined,
      completeDateTime: undefined,
      orderNumber: "",
      userId: preSelectedUserId || "",
      hoursNeeded: null,
      orderTotal: null,
      tip: null,
      clientAttention: "",
      itemDelivered: "",
      pickupNotes: "",
      specialNotes: "",
      length: null,
      width: null,
      height: null,
      weight: null,
    },
    mode: "onSubmit",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const currentUserId = watch("userId");

  // Use useEffect for cleanup on unmount
  useEffect(() => {
    return () => {
      if (uploadedFileKeys.length > 0 && !isSubmitting) {
        const cleanup = async () => {
          try {
            if (!uploadedFileKeys.length || !tempEntityId) {
              return;
            }

            const response = await fetch("/api/file-uploads/cleanup", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fileKeys: uploadedFileKeys,
                entityId: tempEntityId,
                entityType: "on_demand",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                `Failed to clean up files: ${response.status} - ${errorText}`,
              );
            }
          } catch (error) {
            console.error("Error cleaning up files:", error);
          }
        };

        cleanup().catch((err) => {
          console.error("Unhandled promise rejection in cleanup:", err);
        });
      }
    };
  }, [uploadedFileKeys, isSubmitting, tempEntityId]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleFormSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const submitData: CreateOnDemandOrderInput = tempEntityId
        ? { ...data, tempEntityId } as CreateOnDemandOrderInput
        : data as CreateOnDemandOrderInput;

      const result = await createOnDemandOrder(submitData);

      if (result.error) {
        setGeneralError(result.error);
        scrollToTop();
        return;
      }

      if (result.success && result.orderId && uploadedFiles.length > 0) {
        await updateEntityId(result.orderId);
      }

      router.push("/admin/on-demand-orders");
    } catch (err) {
      console.error("Form submission error:", err);
      setGeneralError("An unexpected error occurred. Please try again.");
      scrollToTop();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files?.length) return;

    const files = Array.from(event.target.files) as FileWithPath[];
    try {
      const result = await onUpload(files);
      const newFileKeys = result.map((file) => file.key);
      setUploadedFileKeys((prev) => [...prev, ...newFileKeys]);
    } catch (error) {
      console.error("Upload error:", error);
      setGeneralError(
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "Failed to upload files. Please try again.",
      );
    }
  };

  // Remove file handler
  const removeFile = async (fileToRemove: UploadedFile) => {
    try {
      setUploadedFileKeys((prev) =>
        prev.filter((key) => key !== fileToRemove.key),
      );
      await deleteFile(fileToRemove.key);
    } catch (error) {
      console.error("Error removing file:", error);
      setGeneralError("Failed to remove file. Please try again.");
    }
  };

  // Direct submit handler
  const manualDirectSubmit = async () => {
    try {
      setIsSubmitting(true);
      setGeneralError(null);

      const formData = form.getValues();

      // Ensure required fields are present
      if (!formData.userId) {
        alert("Please select a client");
        setIsSubmitting(false);
        return;
      }

      if (!formData.clientAttention) {
        alert("Please enter client attention/contact name");
        setIsSubmitting(false);
        return;
      }

      if (!formData.pickupDateTime || !formData.arrivalDateTime) {
        alert("Please select pickup and arrival dates");
        setIsSubmitting(false);
        return;
      }

      // Include the tempEntityId in the submitted data if available
      if (tempEntityId) {
        formData.tempEntityId = tempEntityId;
      }

      const result = await createOnDemandOrder(formData as CreateOnDemandOrderInput);

      if (result.success) {
        if (uploadedFiles.length > 0 && result.orderId) {
          await updateEntityId(result.orderId);
        }

        alert("Order created successfully!");
        if (result.orderNumber) {
          router.push(
            `/admin/on-demand-orders/${encodeURIComponent(result.orderNumber)}`,
          );
        }
      } else {
        alert("Failed to create order: " + (result.error || "Unknown error"));
        setGeneralError(result.error || "Unknown error");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error in manual submit:", error);
      setGeneralError(
        "Error: " + (error instanceof Error ? error.message : String(error)),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Display General Errors */}
      {generalError && (
        <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded border border-red-400 bg-red-100 p-4 text-red-700">
          <div className="flex items-center">
            <AlertCircle className="mr-2 h-5 w-5" />
            <p className="font-medium">{generalError}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setGeneralError(null)}
            className="text-red-700 hover:bg-red-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-8"
      >
        {/* Client Selection Combobox */}
        {!preSelectedUserId && clients && (
          <div className="space-y-2">
            <Label htmlFor="userId">Client *</Label>
            {clients.length === 0 ? (
              <div className="w-full rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">No clients available</p>
                <p className="mt-1 text-xs">
                  Please contact your administrator to add CLIENT profiles before creating orders.
                </p>
              </div>
            ) : (
              <Popover
                open={clientComboboxOpen}
                onOpenChange={setClientComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientComboboxOpen}
                    className="w-full justify-between font-normal"
                  >
                    {currentUserId
                      ? clients.find((client) => client.id === currentUserId)?.name
                      : "Select client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search clients..." />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.name}
                            onSelect={(currentValue: string) => {
                              const selectedClientId = clients.find(
                                (c) =>
                                  c.name.toLowerCase() ===
                                  currentValue.toLowerCase(),
                              )?.id;
                              if (selectedClientId) {
                                form.setValue("userId", selectedClientId);
                              }
                              setClientComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentUserId === client.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {client.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            {errors.userId && (
              <p className="text-sm text-red-500">{errors.userId.message}</p>
            )}
          </div>
        )}

        {/* Order Details Section - Vehicle Type and Order Number */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Vehicle Type */}
          <div className="space-y-2">
            <Label htmlFor="vehicleType">Vehicle Type *</Label>
            <Select
              onValueChange={(value) => form.setValue("vehicleType", value as "CAR" | "VAN" | "TRUCK")}
              defaultValue="CAR"
            >
              <SelectTrigger id="vehicleType">
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.vehicleType && (
              <p className="text-sm text-red-500">{errors.vehicleType.message}</p>
            )}
          </div>

          {/* Order Number */}
          <div className="space-y-2">
            <Label htmlFor="orderNumber">Order Number <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Input
              id="orderNumber"
              {...register("orderNumber")}
              placeholder="Auto-generated if empty"
            />
            {errors.orderNumber && (
              <p className="text-sm text-red-500">
                {errors.orderNumber.message}
              </p>
            )}
          </div>
        </div>

        {/* Date/Time Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Pickup Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="pickupDateTime">Pickup Date & Time *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal text-sm px-4",
                    !watch("pickupDateTime") && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {(() => {
                      const pickupDate = watch("pickupDateTime");
                      return pickupDate ? format(pickupDate, "PPPp") : "Pick a date and time";
                    })()}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch("pickupDateTime")}
                  onSelect={(date) => {
                    if (!date) {
                      form.setValue("pickupDateTime", undefined as unknown as Date);
                      return;
                    }

                    const currentDateTime = watch("pickupDateTime");
                    if (currentDateTime) {
                      const newDate = new Date(date);
                      newDate.setHours(
                        currentDateTime.getHours(),
                        currentDateTime.getMinutes(),
                        0,
                        0,
                      );
                      form.setValue("pickupDateTime", newDate);
                    } else {
                      const newDate = new Date(date);
                      newDate.setHours(12, 0, 0, 0);
                      form.setValue("pickupDateTime", newDate);
                    }
                  }}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  captionLayout="dropdown"
                />
                <div className="border-border border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pickupTime">Time</Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      className="w-32"
                      value={(() => {
                        const pickupDate = watch("pickupDateTime");
                        return pickupDate ? format(pickupDate, "HH:mm") : "";
                      })()}
                      onChange={(e) => {
                        const timeValue = e.target.value;
                        if (!timeValue) return;

                        const [hoursStr = "0", minutesStr = "0"] =
                          timeValue.split(":");
                        const hours = parseInt(hoursStr, 10);
                        const minutes = parseInt(minutesStr, 10);

                        if (
                          isNaN(hours) ||
                          isNaN(minutes) ||
                          hours < 0 ||
                          hours > 23 ||
                          minutes < 0 ||
                          minutes > 59
                        )
                          return;

                        const currentDate = watch("pickupDateTime");

                        if (currentDate) {
                          const newDate = new Date(currentDate);
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("pickupDateTime", newDate);
                        } else {
                          const newDate = new Date();
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("pickupDateTime", newDate);
                        }
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {errors.pickupDateTime && (
              <p className="text-sm text-red-500">
                {errors.pickupDateTime.message}
              </p>
            )}
          </div>

          {/* Arrival Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="arrivalDateTime">Arrival Date & Time *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal text-sm px-4",
                    !watch("arrivalDateTime") && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {(() => {
                      const arrivalDate = watch("arrivalDateTime");
                      return arrivalDate ? format(arrivalDate, "PPPp") : "Pick a date and time";
                    })()}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch("arrivalDateTime")}
                  onSelect={(date) => {
                    if (!date) {
                      form.setValue("arrivalDateTime", undefined as unknown as Date);
                      return;
                    }

                    const currentDateTime = watch("arrivalDateTime");
                    if (currentDateTime) {
                      const newDate = new Date(date);
                      newDate.setHours(
                        currentDateTime.getHours(),
                        currentDateTime.getMinutes(),
                        0,
                        0,
                      );
                      form.setValue("arrivalDateTime", newDate);
                    } else {
                      const newDate = new Date(date);
                      newDate.setHours(12, 0, 0, 0);
                      form.setValue("arrivalDateTime", newDate);
                    }
                  }}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  captionLayout="dropdown"
                />
                <div className="border-border border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="arrivalTime">Time</Label>
                    <Input
                      id="arrivalTime"
                      type="time"
                      className="w-32"
                      value={(() => {
                        const arrivalDate = watch("arrivalDateTime");
                        return arrivalDate ? format(arrivalDate, "HH:mm") : "";
                      })()}
                      onChange={(e) => {
                        const timeValue = e.target.value;
                        if (!timeValue) return;

                        const [hoursStr = "0", minutesStr = "0"] =
                          timeValue.split(":");
                        const hours = parseInt(hoursStr, 10);
                        const minutes = parseInt(minutesStr, 10);

                        if (
                          isNaN(hours) ||
                          isNaN(minutes) ||
                          hours < 0 ||
                          hours > 23 ||
                          minutes < 0 ||
                          minutes > 59
                        )
                          return;

                        const currentDate = watch("arrivalDateTime");

                        if (currentDate) {
                          const newDate = new Date(currentDate);
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("arrivalDateTime", newDate);
                        } else {
                          const newDate = new Date();
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("arrivalDateTime", newDate);
                        }
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {errors.arrivalDateTime && (
              <p className="text-sm text-red-500">
                {errors.arrivalDateTime.message}
              </p>
            )}
          </div>

          {/* Hours Needed (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="hoursNeeded">Hours Needed <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Input
              id="hoursNeeded"
              type="number"
              step="0.5"
              min="0"
              {...register("hoursNeeded")}
              placeholder="e.g., 2.5"
            />
            {errors.hoursNeeded && (
              <p className="text-sm text-red-500">{errors.hoursNeeded.message}</p>
            )}
          </div>
        </div>

        {/* Financial Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Order Total */}
          <div className="space-y-2">
            <Label htmlFor="orderTotal">Order Total <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="orderTotal"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                {...register("orderTotal")}
                placeholder="0.00"
              />
            </div>
            {errors.orderTotal && (
              <p className="text-sm text-red-500">{errors.orderTotal.message}</p>
            )}
          </div>

          {/* Tip */}
          <div className="space-y-2">
            <Label htmlFor="tip">Tip <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <Input
                id="tip"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                {...register("tip")}
                placeholder="0.00"
              />
            </div>
            {errors.tip && (
              <p className="text-sm text-red-500">{errors.tip.message}</p>
            )}
          </div>
        </div>

        {/* Address Sections */}
        <div className="space-y-6">
          {/* Pickup Address */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Pickup Address *</Label>
            <AddressSelector
              mode={preSelectedUserId ? "client" : "admin"}
              type="pickup"
              selectedAddressId={selectedPickupAddressId}
              onSelect={(address: Address) => {
                setSelectedPickupAddressId(address.id);
                form.setValue("pickupAddress.street1", address.street1);
                form.setValue("pickupAddress.street2", address.street2 || "");
                form.setValue("pickupAddress.city", address.city);
                form.setValue("pickupAddress.state", address.state);
                form.setValue("pickupAddress.zip", address.zip);
                form.setValue("pickupAddress.county", address.county || "");
              }}
            />
            {errors.pickupAddress && (
              <p className="text-sm text-red-500">Pickup address is required</p>
            )}
          </div>

          {/* Delivery Address */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Delivery Address *</Label>
            <AddressSelector
              mode={preSelectedUserId ? "client" : "admin"}
              type="delivery"
              selectedAddressId={selectedDeliveryAddressId}
              onSelect={(address: Address) => {
                setSelectedDeliveryAddressId(address.id);
                form.setValue("deliveryAddress.street1", address.street1);
                form.setValue("deliveryAddress.street2", address.street2 || "");
                form.setValue("deliveryAddress.city", address.city);
                form.setValue("deliveryAddress.state", address.state);
                form.setValue("deliveryAddress.zip", address.zip);
                form.setValue("deliveryAddress.county", address.county || "");
              }}
            />
            {errors.deliveryAddress && (
              <p className="text-sm text-red-500">Delivery address is required</p>
            )}
          </div>
        </div>

        {/* Package Dimensions (Collapsible) */}
        <Collapsible
          open={dimensionsOpen}
          onOpenChange={setDimensionsOpen}
          className="rounded-lg border border-slate-200 bg-slate-50"
        >
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between p-4 hover:bg-slate-100"
            >
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="font-medium">Package Dimensions</span>
                <span className="text-muted-foreground text-xs">(Optional)</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  dimensionsOpen && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="length">Length (in)</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="0"
                  {...register("length")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width">Width (in)</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="0"
                  {...register("width")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (in)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="0"
                  {...register("height")}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0"
                  {...register("weight")}
                  placeholder="0"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Notes Section */}
        <div className="space-y-6">
          {/* Client Attention */}
          <div className="space-y-2">
            <Label htmlFor="clientAttention">Client Attention / Contact Name *</Label>
            <Input
              id="clientAttention"
              {...register("clientAttention")}
              placeholder="Name of person to contact at delivery"
            />
            {errors.clientAttention && (
              <p className="text-sm text-red-500">{errors.clientAttention.message}</p>
            )}
          </div>

          {/* Item Delivered */}
          <div className="space-y-2">
            <Label htmlFor="itemDelivered">Item Description <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Textarea
              id="itemDelivered"
              {...register("itemDelivered")}
              placeholder="Describe the items being delivered..."
              rows={2}
            />
            {errors.itemDelivered && (
              <p className="text-sm text-red-500">{errors.itemDelivered.message}</p>
            )}
          </div>

          {/* Pickup Notes */}
          <div className="space-y-2">
            <Label htmlFor="pickupNotes">Pickup Notes <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Textarea
              id="pickupNotes"
              {...register("pickupNotes")}
              placeholder="Special instructions for pickup..."
              rows={2}
            />
            {errors.pickupNotes && (
              <p className="text-sm text-red-500">{errors.pickupNotes.message}</p>
            )}
          </div>

          {/* Special Notes */}
          <div className="space-y-2">
            <Label htmlFor="specialNotes">Special Notes <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Textarea
              id="specialNotes"
              {...register("specialNotes")}
              placeholder="Any other special instructions..."
              rows={2}
            />
            {errors.specialNotes && (
              <p className="text-sm text-red-500">{errors.specialNotes.message}</p>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        <div className="space-y-4">
          <Label>Attachments <span className="text-muted-foreground text-xs">(Optional)</span></Label>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  "Choose files"
                )}
              </label>
              <p className="mt-2 text-xs text-slate-500">
                PDF, images, or documents up to 10MB each
              </p>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.key}
                    className="flex items-center justify-between rounded-md bg-white p-2 text-sm shadow-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress */}
            {Object.keys(progresses).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(progresses).map(([key, progress]) => (
                  <div key={key} className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={manualDirectSubmit}
            disabled={isSubmitting || (!preSelectedUserId && (!clients || clients.length === 0))}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Order...
              </>
            ) : (
              "Create On-Demand Order"
            )}
          </Button>
        </div>
      </form>
    </>
  );
};
