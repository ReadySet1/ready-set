// Admin Side

"use client";

import React, {
  useState,
  useTransition,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createCateringOrder } from "@/app/(backend)/admin/catering-orders/_actions/catering-orders"; // Import only action
// Import schema and types from the new schemas file
import {
  createCateringOrderSchema,
  CreateCateringOrderInput,
  ClientListItem,
} from "@/app/(backend)/admin/catering-orders/_actions/schemas";
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
  CalendarIcon,
  Loader2,
  Check,
  ChevronsUpDown,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils"; // For conditional classes
import { AddressSelector } from "@/components/AddressSelector";
import { Address, AddressFormData } from "@/types/address";
import AddAddressForm from "@/components/AddressManager/AddAddressForm";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useUploadFile, UploadedFile } from "@/hooks/use-upload-file"; // Import the upload hook
import { FileWithPath } from "react-dropzone"; // Import FileWithPath type
import { useToast } from "@/components/ui/use-toast";

interface CreateCateringOrderFormProps {
  clients: ClientListItem[];
}

// Define Bay Area counties
const bayAreaCountyValues = [
  "Alameda",
  "Contra Costa",
  "Marin",
  "Napa",
  "San Francisco",
  "San Mateo",
  "Santa Clara",
  "Solano",
  "Sonoma",
];

// Define brokerage options to match user form
const BROKERAGE_OPTIONS = [
  { value: "Foodee", label: "Foodee" },
  { value: "Ez Cater", label: "Ez Cater" },
  { value: "Grubhub", label: "Grubhub" },
  { value: "Cater Cow", label: "Cater Cow" },
  { value: "Cater2me", label: "Cater2me" },
  { value: "Zero Cater", label: "Zero Cater" },
  { value: "Platterz", label: "Platterz" },
  { value: "Direct Delivery", label: "Direct Delivery" },
  { value: "CaterValley", label: "CaterValley ⚡ (Integrated)" },
  { value: "Other", label: "Other" },
];

export const CreateCateringOrderForm: React.FC<
  CreateCateringOrderFormProps
> = ({ clients }) => {
  const router = useRouter();
  const { toast } = useToast();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState<string>("");

  // File upload state
  const [uploadedFileKeys, setUploadedFileKeys] = useState<string[]>([]);

  // Initialize Supabase client
  const supabase = createClient();

  // Get and store the session for userId in useUploadFile
  const [session, setSession] = useState<any>(null);

  // Development mode flag for debugging tools
  const isDevelopment = process.env.NODE_ENV !== "production";

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
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    category: "catering",
    entityType: "catering_order",
    userId: session?.user?.id,
  });

  const form = useForm({
    resolver: zodResolver(createCateringOrderSchema),
    defaultValues: {
      needHost: "NO",
      pickupAddress: { street1: "", city: "", state: "", zip: "" },
      deliveryAddress: { street1: "", city: "", state: "", zip: "" },
      pickupDateTime: undefined,
      arrivalDateTime: undefined,
      completeDateTime: undefined,
      orderNumber: "",
      brokerage: "",
      userId: "",
      hoursNeeded: null,
      numberOfHosts: null,
      headcount: null,
      orderTotal: null,
      tip: null,
      clientAttention: "",
      pickupNotes: "",
      specialNotes: "",
    },
    mode: "onSubmit", // Only validate on form submission to avoid premature errors
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = form;

  // Watch needHost to conditionally show host-related fields
  const needHostValue = watch("needHost");
  const currentUserId = watch("userId");

  // Effect to handle needHost changes
  useEffect(() => {
    if (needHostValue === "NO") {
      // When NO, set host fields to null and clear any validation errors
      form.setValue("hoursNeeded", null, { shouldValidate: true });
      form.setValue("numberOfHosts", null, { shouldValidate: true });
      form.clearErrors(["hoursNeeded", "numberOfHosts"]);
    }
  }, [needHostValue, form]);

  // Use useEffect for cleanup on unmount
  useEffect(() => {
    // Cleanup uploaded files on unmount if not submitted
    return () => {
      if (uploadedFileKeys.length > 0 && !isSubmitting) {
        const cleanup = async () => {
          try {
                        
            // Don't attempt cleanup if we don't have the IDs we need
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
                entityType: "catering_order",
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(
                `Failed to clean up files: ${response.status} - ${errorText}`,
              );
              // Don't throw - just log the error
            } else {
                          }
          } catch (error) {
            console.error("Error cleaning up files:", error);
            // Error already logged, no need to re-throw
          }
        };

        // Execute but don't wait for it since this is in cleanup function
        cleanup().catch((err) => {
          console.error("Unhandled promise rejection in cleanup:", err);
        });
      }
    };
  }, [uploadedFileKeys, isSubmitting, tempEntityId]);

  // Add the scrollToTop utility function
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    setGeneralError(null);

    try {
      // Cast the data to the proper type and include tempEntityId if available
      const submitData: CreateCateringOrderInput = tempEntityId
        ? { ...data, tempEntityId } as CreateCateringOrderInput
        : data as CreateCateringOrderInput;

      const result = await createCateringOrder(submitData);

      if (result.error) {
        setGeneralError(result.error);
        scrollToTop();
        return;
      }

      router.push("/admin/catering-orders");
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
      
      // Set uploaded files to form state
      // setValue("attachments", result); // We'd need to add this to the schema

      // Track file keys for potential cleanup
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
      
      // Remove from UI immediately
      const updatedFiles = uploadedFiles.filter(
        (file) => file.key !== fileToRemove.key,
      );
      // setValue("attachments", updatedFiles); // We'd need to add this to the schema

      // Remove from tracked keys
      setUploadedFileKeys((prev) =>
        prev.filter((key) => key !== fileToRemove.key),
      );

      // Delete the file
      await deleteFile(fileToRemove.key);
          } catch (error) {
      console.error("Error removing file:", error);
      setGeneralError("Failed to remove file. Please try again.");
    }
  };

  // Clear form state only on mount, not on every form change
  useEffect(() => {
    // Only clear errors on mount, not on every form change
    if (generalError === null) {
      form.clearErrors();
    }
  }, [form, generalError]);

  // Keep the cleanup function separate
  useEffect(() => {
    return () => {
      setGeneralError(null);
    };
  }, []);

  // Direct manual submit that bypasses the form's validation
  const manualDirectSubmit = async () => {
    try {
            setIsSubmitting(true);
      setGeneralError(null);

      // Get form data
      const formData = form.getValues();
      
      // Ensure required fields are present
      if (!formData.userId) {
        alert("Please select a client");
        setIsSubmitting(false);
        return;
      }

      if (!formData.pickupDateTime || !formData.arrivalDateTime) {
        alert("Please select pickup and arrival dates");
        setIsSubmitting(false);
        return;
      }

      // Handle needHost validation explicitly
      if (formData.needHost === "NO") {
        // If needHost is NO, ensure hoursNeeded and numberOfHosts are null
        formData.hoursNeeded = null;
        formData.numberOfHosts = null;

        // Update the form values too
        form.setValue("hoursNeeded", null);
        form.setValue("numberOfHosts", null);
      } else if (formData.needHost === "YES") {
        // If needHost is YES, make sure hoursNeeded and numberOfHosts are provided
        if (!formData.hoursNeeded || !formData.numberOfHosts) {
          alert(
            "Hours needed and number of hosts are required when Need Host is Yes",
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Include the tempEntityId in the submitted data if available
      if (tempEntityId) {
        formData.tempEntityId = tempEntityId;
              }

      // Call server action directly - cast to proper type
      const result = await createCateringOrder(formData as CreateCateringOrderInput);
      
      if (result.success) {
        // If we have uploaded files, update their entity ID
        if (uploadedFiles.length > 0 && result.orderId) {
                    await updateEntityId(result.orderId);
        }

        alert("Order created successfully!");
        if (result.orderNumber) {
          router.push(
            `/admin/catering-orders/${encodeURIComponent(result.orderNumber)}`,
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

  // Add a direct debug submit function
  const debugSubmit = () => {
    // Log the current form state
    const formData = form.getValues();
    
    // Handle needHost validation manually
    if (formData.needHost === "NO") {
      // If needHost is NO, ensure hoursNeeded and numberOfHosts are set to null
      formData.hoursNeeded = null;
      formData.numberOfHosts = null;

      // Update the form values
      form.setValue("hoursNeeded", null);
      form.setValue("numberOfHosts", null);
    }

    // Try to manually trigger validation
    form.trigger().then((isValid) => {
      
      if (!isValid) {
        // Alert about validation errors
        alert("Form validation failed. Please check the form for errors.");
              } else {
        // If valid, try to manually submit
        
        // Show submission in progress
        setIsSubmitting(true);

        // Directly call the server action - cast to proper type
        createCateringOrder(formData as CreateCateringOrderInput)
          .then((result) => {
                        if (result.success) {
              alert("Order created successfully!");
              if (result.orderNumber) {
                router.push(
                  `/admin/catering-orders/${encodeURIComponent(result.orderNumber)}`,
                );
              }
            } else {
              alert(
                "Order creation failed: " + (result.error || "Unknown error"),
              );
              setGeneralError(result.error || "Unknown error");
              setIsSubmitting(false);
            }
          })
          .catch((error) => {
            console.error("Manual submission error:", error);
            alert("Error submitting: " + error.message);
            setGeneralError("Error: " + error.message);
            setIsSubmitting(false);
          });
      }
    });
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
        <div className="space-y-2">
          <Label htmlFor="userId">Client</Label>
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
                          value={client.name} // Use name for filtering in CommandInput
                          onSelect={(currentValue: string) => {
                            const selectedClientId = clients.find(
                              (c) =>
                                c.name.toLowerCase() ===
                                currentValue.toLowerCase(),
                            )?.id;
                            if (selectedClientId) {
                              form.setValue("userId", selectedClientId);
                              setSelectedClientName(client.name);
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

        {/* Order Details Section - Brokerage and Order Number */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Brokerage Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="brokerage">Brokerage / Direct</Label>
            <Select
              onValueChange={(value) => form.setValue("brokerage", value)}
              defaultValue={
                form.getValues("brokerage") === null
                  ? undefined
                  : form.getValues("brokerage") || ""
              }
            >
              <SelectTrigger id="brokerage">
                <SelectValue placeholder="Select brokerage" />
              </SelectTrigger>
              <SelectContent>
                {BROKERAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.brokerage && (
              <p className="text-sm text-red-500">{errors.brokerage.message}</p>
            )}
          </div>

          {/* Order Number */}
          <div className="space-y-2">
            <Label htmlFor="orderNumber">Order Number</Label>
            <Input
              id="orderNumber"
              {...register("orderNumber")}
              placeholder="e.g., ORD-12345"
            />
            {errors.orderNumber && (
              <p className="text-sm text-red-500">
                {errors.orderNumber.message}
              </p>
            )}
          </div>
        </div>

        {/* Order Details Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Pickup Date & Time */}
          <div className="space-y-2">
            <Label htmlFor="pickupDateTime">Pickup Date & Time</Label>
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
                    {watch("pickupDateTime") ? (
                      format(watch("pickupDateTime"), "PPPp")
                    ) : (
                      "Pick a date and time"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch("pickupDateTime")}
                  onSelect={(date) => {
                    if (!date) {
                      form.setValue(
                        "pickupDateTime",
                        undefined as unknown as Date,
                      );
                      return;
                    }

                    // Preserve current time if date already exists
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
                      // Set default time (noon) if no previous time
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
                {/* Time Input */}
                <div className="border-border border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pickupTime">Time</Label>
                    <Input
                      id="pickupTime"
                      type="time"
                      className="w-32"
                      value={
                        watch("pickupDateTime")
                          ? format(watch("pickupDateTime"), "HH:mm")
                          : ""
                      }
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

                        // If we have a date, update it with the new time
                        if (currentDate) {
                          const newDate = new Date(currentDate);
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("pickupDateTime", newDate);
                        } else {
                          // If no date selected, use today with the selected time
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
            <Label htmlFor="arrivalDateTime">Arrival Date & Time</Label>
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
                    {watch("arrivalDateTime") ? (
                      format(watch("arrivalDateTime"), "PPPp")
                    ) : (
                      "Pick a date and time"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch("arrivalDateTime")}
                  onSelect={(date) => {
                    if (!date) {
                      form.setValue(
                        "arrivalDateTime",
                        undefined as unknown as Date,
                      );
                      return;
                    }

                    // Preserve current time if date already exists
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
                      // Set default time (noon) if no previous time
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
                {/* Time Input */}
                <div className="border-border border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="arrivalTime">Time</Label>
                    <Input
                      id="arrivalTime"
                      type="time"
                      className="w-32"
                      value={
                        watch("arrivalDateTime")
                          ? format(watch("arrivalDateTime"), "HH:mm")
                          : ""
                      }
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

                        // If we have a date, update it with the new time
                        if (currentDate) {
                          const newDate = new Date(currentDate);
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("arrivalDateTime", newDate);
                        } else {
                          // If no date selected, use today with the selected time
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

          {/* Complete Date & Time (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="completeDateTime">
              Complete Date & Time{" "}
              <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal text-sm px-4",
                    !watch("completeDateTime") && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {watch("completeDateTime") ? (
                      format(watch("completeDateTime") as Date, "PPPp")
                    ) : (
                      "Pick a date and time"
                    )}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={watch("completeDateTime") as Date | undefined}
                  onSelect={(date) => {
                    if (!date) {
                      form.setValue("completeDateTime", undefined);
                      return;
                    }

                    // Preserve current time if date already exists
                    const currentDateTime = watch("completeDateTime") as
                      | Date
                      | undefined;
                    if (currentDateTime) {
                      const newDate = new Date(date);
                      newDate.setHours(
                        currentDateTime.getHours(),
                        currentDateTime.getMinutes(),
                        0,
                        0,
                      );
                      form.setValue("completeDateTime", newDate);
                    } else {
                      // Set default time (noon) if no previous time
                      const newDate = new Date(date);
                      newDate.setHours(12, 0, 0, 0);
                      form.setValue("completeDateTime", newDate);
                    }
                  }}
                  disabled={(date) =>
                    date < new Date(new Date().setHours(0, 0, 0, 0))
                  }
                  captionLayout="dropdown"
                />
                {/* Time Input */}
                <div className="border-border border-t p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="completeTime">Time</Label>
                    <Input
                      id="completeTime"
                      type="time"
                      className="w-32"
                      value={
                        watch("completeDateTime")
                          ? format(watch("completeDateTime") as Date, "HH:mm")
                          : ""
                      }
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

                        const currentDate = watch("completeDateTime") as
                          | Date
                          | undefined;

                        // If we have a date, update it with the new time
                        if (currentDate) {
                          const newDate = new Date(currentDate);
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("completeDateTime", newDate);
                        } else {
                          // If no date selected, use today with the selected time
                          const newDate = new Date();
                          newDate.setHours(hours, minutes, 0, 0);
                          form.setValue("completeDateTime", newDate);
                        }
                      }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {errors.completeDateTime && (
              <p className="text-sm text-red-500">
                {errors.completeDateTime.message}
              </p>
            )}
          </div>

          {/* Headcount */}
          <div className="space-y-2">
            <Label htmlFor="headcount">Headcount (Optional)</Label>
            <Controller
              name="headcount"
              control={control}
              render={({ field: { onChange, value, ...field } }) => {
                const numValue = value as number | null;
                return (
                  <Input
                    {...field}
                    id="headcount"
                    type="number"
                    value={numValue === null ? "" : numValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(val === "" ? null : Number(val));
                    }}
                    placeholder="e.g., 50"
                  />
                );
              }}
            />
            {errors.headcount && (
              <p className="text-sm text-red-500">{errors.headcount.message}</p>
            )}
          </div>

          {/* Order Total */}
          <div className="space-y-2">
            <Label htmlFor="orderTotal">Order Total (Optional)</Label>
            <Controller
              name="orderTotal"
              control={control}
              render={({ field: { onChange, value, ...field } }) => {
                const numValue = value as number | null;
                return (
                  <Input
                    {...field}
                    id="orderTotal"
                    type="number"
                    step="0.01"
                    value={numValue === null ? "" : numValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(val === "" ? null : Number(val));
                    }}
                    placeholder="e.g., 1250.50"
                  />
                );
              }}
            />
            {errors.orderTotal && (
              <p className="text-sm text-red-500">
                {errors.orderTotal.message}
              </p>
            )}
          </div>

          {/* Tip */}
          <div className="space-y-2">
            <Label htmlFor="tip">Tip (Optional)</Label>
            <Controller
              name="tip"
              control={control}
              render={({ field: { onChange, value, ...field } }) => {
                const numValue = value as number | null;
                return (
                  <Input
                    {...field}
                    id="tip"
                    type="number"
                    step="0.01"
                    value={numValue === null ? "" : numValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(val === "" ? null : Number(val));
                    }}
                    placeholder="e.g., 100.00"
                  />
                );
              }}
            />
            {errors.tip && (
              <p className="text-sm text-red-500">{errors.tip.message}</p>
            )}
          </div>
        </div>

        {/* Host Needs Section */}
        <div className="space-y-4 rounded-md border bg-slate-50/50 p-4">
          <h4 className="text-md mb-3 font-semibold">Host Requirements</h4>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="needHost">Need Host?</Label>
              <Select
                onValueChange={(value) => {
                  const newValue = value as "YES" | "NO";
                  form.setValue("needHost", newValue, { shouldValidate: true });

                  // Clear any existing validation errors
                  form.clearErrors(["hoursNeeded", "numberOfHosts"]);

                  if (newValue === "NO") {
                    // When NO, set host fields to null
                    form.setValue("hoursNeeded", null, {
                      shouldValidate: true,
                    });
                    form.setValue("numberOfHosts", null, {
                      shouldValidate: true,
                    });
                  }
                }}
                defaultValue={form.getValues("needHost")}
              >
                <SelectTrigger id="needHost">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO">No</SelectItem>
                  <SelectItem value="YES">Yes</SelectItem>
                </SelectContent>
              </Select>
              {errors.needHost && (
                <p className="text-sm text-red-500">
                  {errors.needHost.message}
                </p>
              )}
            </div>

            {/* Conditionally render Hours Needed and Number of Hosts */}
            {needHostValue === "YES" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="hoursNeeded">Hours Needed</Label>
                  <Controller
                    name="hoursNeeded"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => {
                      const numValue = value as number | null;
                      return (
                        <Input
                          {...field}
                          id="hoursNeeded"
                          type="number"
                          step="0.1"
                          value={numValue === null ? "" : numValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === "" ? null : parseFloat(val));
                          }}
                          placeholder="e.g., 4.5"
                        />
                      );
                    }}
                  />
                  {errors.hoursNeeded && (
                    <p className="text-sm text-red-500">
                      {errors.hoursNeeded.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numberOfHosts">Number of Hosts</Label>
                  <Controller
                    name="numberOfHosts"
                    control={control}
                    render={({ field: { onChange, value, ...field } }) => {
                      const numValue = value as number | null;
                      return (
                        <Input
                          {...field}
                          id="numberOfHosts"
                          type="number"
                          value={numValue === null ? "" : numValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            onChange(val === "" ? null : parseInt(val, 10));
                          }}
                          placeholder="e.g., 2"
                        />
                      );
                    }}
                  />
                  {errors.numberOfHosts && (
                    <p className="text-sm text-red-500">
                      {errors.numberOfHosts.message}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Address Sections */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-md border bg-slate-50/50 p-4">
            <h4 className="text-md mb-3 font-semibold">Pickup Address</h4>
            <AddressSelector
              mode="admin"
              type="pickup"
              onSelect={(address) => {
                setValue("pickupAddress", address);
              }}
              selectedAddressId={'id' in watch("pickupAddress") ? (watch("pickupAddress") as { id?: string }).id : undefined}
              showFavorites
              showRecents
              allowAddNew
            />
            {errors.pickupAddress && (
              <div className="mt-2 text-sm text-red-500">
                {errors.pickupAddress.street1?.message ||
                  errors.pickupAddress.city?.message ||
                  errors.pickupAddress.state?.message ||
                  errors.pickupAddress.zip?.message}
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-md border bg-slate-50/50 p-4">
            <h4 className="text-md mb-3 font-semibold">Delivery Address</h4>
            <AddressSelector
              mode="admin"
              type="delivery"
              onSelect={(address) => {
                setValue("deliveryAddress", address);
              }}
              selectedAddressId={'id' in watch("deliveryAddress") ? (watch("deliveryAddress") as { id?: string }).id : undefined}
              showFavorites
              showRecents
              allowAddNew
            />
            {errors.deliveryAddress && (
              <div className="mt-2 text-sm text-red-500">
                {errors.deliveryAddress.street1?.message ||
                  errors.deliveryAddress.city?.message ||
                  errors.deliveryAddress.state?.message ||
                  errors.deliveryAddress.zip?.message}
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="clientAttention">Client Attention (Optional)</Label>
            <Textarea
              id="clientAttention"
              {...register("clientAttention")}
              placeholder="Specific person or department"
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="pickupNotes">Pickup Notes (Optional)</Label>
            <Textarea
              id="pickupNotes"
              {...register("pickupNotes")}
              placeholder="e.g., Call upon arrival, specific instructions"
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="specialNotes">Special Notes (Optional)</Label>
            <Textarea
              id="specialNotes"
              {...register("specialNotes")}
              placeholder="e.g., Allergies, dietary restrictions, setup requirements"
            />
          </div>
        </div>

        {/* File Attachments Section */}
        <div className="space-y-4 rounded-md border bg-slate-50/50 p-4">
          <h4 className="text-md mb-3 font-semibold">Attachments (Optional)</h4>
          <div className="space-y-2">
            <div>
              <Label htmlFor="file-upload" className="mb-2 block">
                Upload Files
              </Label>
              <input
                id="file-upload"
                type="file"
                onChange={handleFileUpload}
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isUploading || isSubmitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Maximum 5 files. Supported formats: PDF, Word, JPEG, PNG, WebP.
                Max size: 10MB per file.
              </p>
            </div>
          </div>

          {/* File list */}
          <div className="space-y-2">
            {uploadedFiles?.map((file: UploadedFile) => (
              <div
                key={file.key}
                className="flex items-center justify-between rounded-md border border-gray-200 p-2"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">{file.name}</span>
                  {progresses &&
                    typeof file.name === "string" &&
                    typeof progresses === "object" &&
                    progresses !== null &&
                    file.name in progresses && (
                      <span className="text-xs text-gray-500">
                        {Math.round(
                          progresses[file.name as keyof typeof progresses] || 0,
                        )}
                        %
                      </span>
                    )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file)}
                  disabled={isUploading || isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2">
          {generalError && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset();
                setGeneralError(null);
                // Reset any other form state
                setUploadedFileKeys([]);
              }}
            >
              Reset Form
            </Button>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
              </>
            ) : (
              "Create Order"
            )}
          </Button>
        </div>
      </form>
    </>
  );
};
