// User side

import React, { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { CateringFormData, Address } from "@/types/catering";
import { CateringNeedHost } from "@/types/order";
import { createClient } from "@/utils/supabase/client";
import AddressManager from "../AddressManager";
import {
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Clipboard,
  MapPin,
  X,
} from "lucide-react";
import { useUploadFile, UploadedFile } from "@/hooks/use-upload-file";
import { FileWithPath } from "react-dropzone";
import { HostSection } from "./HostSection";
import { CateringOrderSuccessModal } from "../Orders/CateringOrders/CateringOrderSuccessModal";

// Form field components
const InputField: React.FC<{
  control: any;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  rules?: any;
  rows?: number;
  placeholder?: string;
  icon?: React.ReactNode;
}> = ({
  control,
  name,
  label,
  type = "text",
  required = false,
  optional = false,
  rules = {},
  rows,
  placeholder,
  icon,
}) => (
  <div className="relative mb-4">
    <label
      htmlFor={name}
      className="mb-2 block text-sm font-medium text-gray-700"
    >
      {label}{" "}
      {optional ? (
        <span className="text-xs text-gray-500">(Optional)</span>
      ) : (
        ""
      )}
    </label>
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? `${label} is required` : false, ...rules }}
      render={({ field, fieldState: { error } }) => (
        <div>
          <div className="relative">
            {icon && (
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                {icon}
              </div>
            )}
            {type === "textarea" ? (
              <textarea
                {...field}
                id={name}
                rows={rows || 3}
                className={`w-full rounded-md border ${
                  error ? "border-red-500" : "border-gray-300"
                } ${icon ? "pl-10" : "pl-3"} py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                placeholder={placeholder}
              />
            ) : (
              <input
                {...field}
                id={name}
                type={type}
                className={`w-full rounded-md border ${
                  error ? "border-red-500" : "border-gray-300"
                } ${icon ? "pl-10" : "pl-3"} py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500`}
                placeholder={placeholder}
              />
            )}
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-500">{error.message}</p>
          )}
        </div>
      )}
    />
  </div>
);

const SelectField: React.FC<{
  control: any;
  name: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
  optional?: boolean;
  icon?: React.ReactNode;
}> = ({
  control,
  name,
  label,
  options,
  required = false,
  optional = false,
  icon,
}) => (
  <div className="mb-4">
    <label
      htmlFor={name}
      className="mb-2 block text-sm font-medium text-gray-700"
    >
      {label}{" "}
      {optional ? (
        <span className="text-xs text-gray-500">(Optional)</span>
      ) : (
        ""
      )}
    </label>
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? `${label} is required` : false }}
      render={({ field, fieldState: { error } }) => (
        <div>
          <div className="relative">
            {icon && (
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                {icon}
              </div>
            )}
            <select
              {...field}
              id={name}
              className={`w-full rounded-md border ${
                error ? "border-red-500" : "border-gray-300"
              } ${icon ? "pl-10" : "pl-3"} py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500`}
            >
              <option value="">Select {label}</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="mt-1 text-xs text-red-500">{error.message}</p>
          )}
        </div>
      )}
    />
  </div>
);

// Form Component
interface ExtendedCateringFormData extends CateringFormData {
  attachments?: UploadedFile[];
  brokerage?: string;
  orderNumber: string;
  date: string;
  pickupTime: string;
  arrivalTime: string;
  completeTime?: string;
  headcount: string;
  needHost: CateringNeedHost;
  hoursNeeded: string;
  numberOfHosts?: string;
  clientAttention?: string;
  pickupNotes?: string;
  specialNotes?: string;
  orderTotal?: string;
  tip?: string;
  pickupAddress?: Address;
  deliveryAddress?: Address;
}

const BROKERAGE_OPTIONS = [
  { value: "Foodee", label: "Foodee" },
  { value: "Ez Cater", label: "Ez Cater" },
  { value: "Grubhub", label: "Grubhub" },
  { value: "Cater Cow", label: "Cater Cow" },
  { value: "Cater2me", label: "Cater2me" },
  { value: "Zero Cater", label: "Zero Cater" },
  { value: "Platterz", label: "Platterz" },
  { value: "Direct Delivery", label: "Direct Delivery" },
  {
    value: "CaterValley",
    label: "CaterValley ⚡",
    description: "Integrated partner with real-time updates",
  },
  { value: "Other", label: "Other" },
];

/**
 * CateringRequestForm
 * @param client Optional client object (used in admin mode to submit on behalf of a client)
 * @param isAdminMode If true, uses the provided client instead of the logged-in user
 */
interface CateringRequestFormProps {
  client?: import("@/types/client").Client;
  isAdminMode?: boolean;
}

const CateringRequestForm: React.FC<CateringRequestFormProps> = ({
  client,
  isAdminMode = false,
}) => {
  const router = useRouter();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFileKeys, setUploadedFileKeys] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<any>(null);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = await createClient();
        setSupabase(client);
      } catch (error) {
        console.error("Error initializing Supabase client:", error);
        toast.error("Error connecting to the service. Please try again.");
        setIsInitializing(false);
      }
    };

    initSupabase();
  }, []);

  // Form initialization
  const { control, handleSubmit, watch, setValue, reset } =
    useForm<ExtendedCateringFormData>({
      defaultValues: {
        brokerage: "",
        orderNumber: "",
        date: new Date().toISOString().split("T")[0],
        pickupTime: "",
        arrivalTime: "",
        completeTime: "",
        headcount: "",
        needHost: CateringNeedHost.NO,
        hoursNeeded: "",
        numberOfHosts: "",
        clientAttention: "",
        pickupNotes: "",
        specialNotes: "",
        orderTotal: "",
        tip: "",
        pickupAddress: {
          id: "",
          street1: "",
          street2: null,
          city: "",
          state: "",
          zip: "",
          locationNumber: null,
          parkingLoading: null,
          isRestaurant: false,
          isShared: false,
        },
        deliveryAddress: {
          id: "",
          street1: "",
          street2: null,
          city: "",
          state: "",
          zip: "",
          locationNumber: null,
          parkingLoading: null,
          isRestaurant: false,
          isShared: false,
        },
        attachments: [],
      },
    });

  // Fetch Supabase session when client is initialized
  useEffect(() => {
    if (!supabase) return;

    const fetchSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchSession();

    // Set up listener for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleAddressesLoaded = useCallback((loadedAddresses: Address[]) => {
    setAddresses(loadedAddresses);
  }, []);

  const needHost = watch("needHost");

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
    category: "catering",
    entityType: "catering_request",
    userId: session?.user?.id,
  });

  // Updated cleanupUploadedFiles function with safety check
  const cleanupUploadedFiles = useCallback(
    async (fileKeys: string[]) => {
      if (!fileKeys.length) return;

      try {
        console.log("Cleaning up uploaded files:", fileKeys);
        const response = await fetch("/api/file-uploads/cleanup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileKeys,
            entityId: tempEntityId,
            entityType: "catering_request",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Error response from cleanup API:", errorData);
          throw new Error(errorData.error || "Failed to clean up files");
        }

        const result = await response.json();
        console.log("Cleanup result:", result);
      } catch (error) {
        console.error("Error cleaning up files:", error);
      }
    },
    [tempEntityId],
  );

  // Handle window/tab close - cleanup orphaned files
  // Updated useEffect for beforeUnload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show dialog and cleanup if we have files AND we're not submitting the form
      if (uploadedFileKeys.length > 0 && !isSubmitting) {
        // Show browser's default "Changes you made may not be saved" dialog
        e.preventDefault();
        e.returnValue = "";

        // Only attempt cleanup for files that aren't being submitted
        cleanupUploadedFiles(uploadedFileKeys);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Cleanup if component unmounts without submission
      if (uploadedFileKeys.length > 0 && !isSubmitting) {
        cleanupUploadedFiles(uploadedFileKeys);
      }
    };
  }, [uploadedFileKeys, isSubmitting, cleanupUploadedFiles]);

  // Handle file upload
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target.files?.length) return;

    const files = Array.from(event.target.files) as FileWithPath[];
    try {
      console.log("Starting upload of", files.length, "files");
      const result = await onUpload(files);
      console.log("Upload completed successfully:", result);

      // Set uploaded files to form data
      setValue("attachments", result);

      // Track file keys for potential cleanup
      const newFileKeys = result.map((file) => file.key);
      setUploadedFileKeys((prev) => [...prev, ...newFileKeys]);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "Failed to upload files. Please try again.",
      );
    }
  };

  // Remove file handler
  const removeFile = async (fileToRemove: UploadedFile) => {
    try {
      console.log("Removing file:", fileToRemove);

      // Remove from UI immediately
      const updatedFiles = uploadedFiles.filter(
        (file) => file.key !== fileToRemove.key,
      );
      setValue("attachments", updatedFiles);

      // Remove from tracked keys
      setUploadedFileKeys((prev) =>
        prev.filter((key) => key !== fileToRemove.key),
      );

      // Delete the file
      await deleteFile(fileToRemove.key);
      console.log("File removed successfully");
    } catch (error) {
      console.error("Error removing file:", error);
      toast.error("Failed to remove file. Please try again.");
    }
  };

  const handleViewOrderDetails = (orderId: string) => {
    console.log("🚀 handleViewOrderDetails called with orderId:", orderId);
    console.log("Current router:", router);
    const targetUrl = `/client/catering-order-details/${orderId}`;
    console.log("Navigating to:", targetUrl);

    router.push(targetUrl);
  };

  const handleShowSuccessModal = (
    formData: ExtendedCateringFormData,
    orderNumber: string,
    orderId?: string,
  ) => {
    console.log("🎯 handleShowSuccessModal called");
    console.log("Form data:", formData);
    console.log("Order number:", orderNumber);
    console.log("Order ID:", orderId);

    // Create order data for the modal
    const orderData = {
      orderId,
      orderNumber,
      clientName: client?.title || session?.user?.email || "Unknown Client",
      pickupDateTime: new Date(`${formData.date}T${formData.pickupTime}`),
      deliveryDateTime: new Date(`${formData.date}T${formData.arrivalTime}`),
      pickupAddress: formData.pickupAddress || {
        street1: "",
        city: "",
        state: "",
        zip: "",
      },
      deliveryAddress: formData.deliveryAddress || {
        street1: "",
        city: "",
        state: "",
        zip: "",
      },
      headcount: parseInt(formData.headcount) || 0,
      needHost: formData.needHost,
      hoursNeeded: formData.hoursNeeded
        ? parseInt(formData.hoursNeeded)
        : undefined,
      numberOfHosts: formData.numberOfHosts
        ? parseInt(formData.numberOfHosts)
        : undefined,
    };

    console.log("Order data for modal:", orderData);
    console.log("Setting successOrderData and showSuccessModal");
    setSuccessOrderData(orderData);
    setShowSuccessModal(true);
    console.log("Modal state set to true");

    // Force a re-render by updating state
    setTimeout(() => {
      console.log("Current modal state - showSuccessModal:", showSuccessModal);
      console.log("Current modal state - successOrderData:", successOrderData);
    }, 100);
  };

  const onSubmit = async (data: ExtendedCateringFormData) => {
    console.log("Starting catering form submission");
    console.log("Form data:", JSON.stringify(data, null, 2));
    console.log("Form data summary:", {
      orderNumber: data.orderNumber,
      brokerage: data.brokerage,
      date: data.date,
      pickupTime: data.pickupTime,
      arrivalTime: data.arrivalTime,
      headcount: data.headcount,
      needHost: data.needHost,
      clientAttention: data.clientAttention,
      orderTotal: data.orderTotal,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      attachments: data.attachments?.length,
    });

    // In admin mode, require a client prop
    if (isAdminMode && !client) {
      toast.error("A client must be selected for admin submission.");
      return;
    }
    if (!isAdminMode && !session?.user?.id) {
      setErrorMessage("Please log in to submit an order");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    const userId = session?.user?.id;
    try {
      const requestBody = {
        ...data,
        attachments: data.attachments,
        userId,
        clientId: isAdminMode && client ? client.id : undefined,
      };

      console.log(
        "Submitting request body:",
        JSON.stringify(requestBody, null, 2),
      );

      const response = await fetch("/api/catering-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      let responseData: any = null;
      try {
        responseData = await response.json();
        console.log("API Response status:", response.status);
        console.log("API Response data:", responseData);
      } catch (jsonErr) {
        console.error("Error parsing JSON response:", jsonErr);
        responseData = {};
      }

      if (!response.ok) {
        if (response.status === 400) {
          const errorMessage = responseData.message || "Invalid request data";
          console.error("API validation error:", responseData);
          setErrorMessage(errorMessage);
          return;
        } else if (response.status === 401) {
          setErrorMessage("Please log in to submit an order");
          return;
        } else if (response.status === 409) {
          setErrorMessage("This order number already exists");
          return;
        } else {
          console.error("API error response:", responseData);
          setErrorMessage(responseData.message || "Failed to submit order");
          return;
        }
      }

      console.log("Order submitted successfully:", responseData);
      console.log("About to show success modal...");

      // IMPORTANT FIX: Update the file entity IDs to link them to the catering request
      if (responseData.orderId && uploadedFiles.length > 0) {
        console.log(
          `Updating file entity IDs to associate with catering request ID: ${responseData.orderId}`,
        );
        try {
          await updateEntityId(responseData.orderId);
          console.log("Files successfully linked to catering request");
        } catch (fileUpdateError) {
          console.error(
            "Error linking files to catering request:",
            fileUpdateError,
          );
          // Don't fail the whole submission, just log the error
        }
      }

      reset();
      toast.success("Catering request submitted successfully!");
      setErrorMessage("");

      // Show success modal with order details
      // Use the order number from the API response if available, otherwise use form data
      console.log("API Response:", responseData);
      console.log("Form data order number:", data.orderNumber);

      const orderNumber = responseData.orderNumber || data.orderNumber;

      console.log("Final check - orderNumber:", orderNumber);
      console.log("API Response orderId:", responseData.orderId);
      if (orderNumber) {
        console.log(
          "Calling handleShowSuccessModal with orderNumber:",
          orderNumber,
          "and orderId:",
          responseData.orderId,
        );
        handleShowSuccessModal(data, orderNumber, responseData.orderId);
      } else {
        // Fallback if no order number available
        console.log("No order number available, showing basic success");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Return the form JSX ---
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-md"
    >
      {errorMessage && (
        <div className="mb-6 flex rounded-md bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">{errorMessage}</div>
        </div>
      )}

      <div className="mb-6">
        <h3 className="mb-4 border-b border-gray-200 pb-2 text-lg font-medium text-gray-800">
          Pickup Location
        </h3>
        <AddressManager
          onAddressesLoaded={handleAddressesLoaded}
          onAddressSelected={(addressId) => {
            const selectedAddress = addresses.find(
              (addr) => addr.id === addressId,
            );
            if (selectedAddress) {
              setValue("pickupAddress", selectedAddress);
            }
          }}
          showFilters={true}
          showManagementButtons={true}
        />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <SelectField
          control={control}
          name="brokerage"
          label="Brokerage / Direct"
          options={BROKERAGE_OPTIONS}
          required
          icon={<Clipboard size={16} />}
        />
        <InputField
          control={control}
          name="orderNumber"
          label="Order Number"
          required
          placeholder="e.g., ORD-12345"
          icon={<Clipboard size={16} />}
        />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <InputField
          control={control}
          name="date"
          label="Date"
          type="date"
          required
          icon={<Calendar size={16} />}
        />
        <InputField
          control={control}
          name="headcount"
          label="Headcount"
          type="number"
          placeholder="Number of people"
          required
          icon={<Users size={16} />}
        />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <InputField
          control={control}
          name="pickupTime"
          label="Pick Up Time"
          type="time"
          required
          icon={<Clock size={16} />}
        />
        <InputField
          control={control}
          name="arrivalTime"
          label="Arrival Time"
          type="time"
          required
          icon={<Clock size={16} />}
        />
        <InputField
          control={control}
          name="completeTime"
          label="Complete Time"
          type="time"
          optional
          icon={<Clock size={16} />}
        />
      </div>

      <div className="mb-8 rounded-lg bg-gray-50 p-6">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Do you need a Host?
          </label>
          <Controller
            name="needHost"
            control={control}
            render={({ field }) => (
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...field}
                    value={CateringNeedHost.YES}
                    checked={field.value === CateringNeedHost.YES}
                    className="mr-3 h-5 w-5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...field}
                    value={CateringNeedHost.NO}
                    checked={field.value === CateringNeedHost.NO}
                    className="mr-3 h-5 w-5 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
            )}
          />
        </div>
        <HostSection control={control} needHost={needHost} />
      </div>

      <div className="mb-8">
        <InputField
          control={control}
          name="clientAttention"
          label="Client / Attention"
          required
          placeholder="Enter client name or attention"
          icon={<Users size={16} />}
        />
      </div>

      <div className="mb-8">
        <h3 className="mb-5 border-b border-gray-200 pb-3 text-lg font-medium text-gray-800">
          Delivery Details
        </h3>
        <AddressManager
          onAddressesLoaded={handleAddressesLoaded}
          onAddressSelected={(addressId) => {
            const selectedAddress = addresses.find(
              (addr) => addr.id === addressId,
            );
            if (selectedAddress) {
              setValue("deliveryAddress", selectedAddress);
            }
          }}
          showFilters={true}
          showManagementButtons={true}
        />
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <InputField
          control={control}
          name="orderTotal"
          label="Order Total ($)"
          type="number"
          required
          placeholder="0.00"
          rules={{ min: { value: 0, message: "Order total must be positive" } }}
          icon={<DollarSign size={16} />}
        />
        <InputField
          control={control}
          name="tip"
          label="Tip ($)"
          type="number"
          optional
          placeholder="0.00"
          rules={{
            validate: (value: string | undefined) => {
              if (value === undefined || value === "") return true;
              const num = parseFloat(value);
              return (
                (!isNaN(num) && num >= 0) ||
                "Tip must be a positive number or empty"
              );
            },
          }}
          icon={<DollarSign size={16} />}
        />
      </div>

      <div className="mb-8">
        <h3 className="mb-5 border-b border-gray-200 pb-3 text-lg font-medium text-gray-800">
          Additional Notes
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          <InputField
            control={control}
            name="pickupNotes"
            label="Pick Up Notes"
            type="textarea"
            rows={3}
            optional
            placeholder="Any special instructions for pickup"
          />
          <InputField
            control={control}
            name="specialNotes"
            label="Special Notes"
            type="textarea"
            rows={3}
            optional
            placeholder="Any other special requests or instructions"
          />
        </div>
      </div>
      {/*
      <div className="mb-8 space-y-4">
        <h3 className="mb-5 border-b border-gray-200 pb-3 text-lg font-medium text-gray-800">
          Attachments
        </h3>
        <div className="space-y-2">
          <input
            type="file"
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isUploading || isSubmitting}
          />
          <p className="text-xs text-gray-500">
            Maximum 5 files. Supported formats: PDF, Word, JPEG, PNG, WebP. Max
            size: 10MB per file.
          </p>
        </div>

        <div className="space-y-2">
          {uploadedFiles?.map((file: UploadedFile) => (
            <div
              key={file.key}
              className="flex items-center justify-between rounded-md border border-gray-200 p-2"
            >
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{file.name}</span>
                {progresses && progresses[file.name] !== undefined && (
                  <span className="text-xs text-gray-500">
                    {Math.round(progresses[file.name])}%
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeFile(file)}
                className="text-gray-400 hover:text-gray-600"
                disabled={isUploading || isSubmitting}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div> */}

      <div className="mt-8 flex items-center justify-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className={`relative w-full rounded-md px-6 py-3 font-medium text-white transition ${
            isSubmitting
              ? "cursor-not-allowed bg-blue-400"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <div
            className={`flex items-center justify-center ${isSubmitting ? "opacity-0" : ""}`}
          >
            Submit Catering Request
          </div>
          {isSubmitting && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
              <span className="ml-2">Submitting...</span>
            </div>
          )}
        </button>
      </div>
      <CateringOrderSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          console.log("Modal close triggered");
          setShowSuccessModal(false);
          setSuccessOrderData(null);
          // Redirect to appropriate dashboard after modal is closed
          try {
            if (session?.user?.email) {
              // Get user profile to determine their type
              fetch(
                `/api/users/profile?email=${encodeURIComponent(session.user.email)}`,
              )
                .then((response) => {
                  if (response.ok) {
                    return response.json();
                  }
                  return { type: "CLIENT" }; // Fallback
                })
                .then((profile) => {
                  const dashboardPath =
                    profile.type === "VENDOR" ? "/vendor" : "/client";
                  console.log(
                    `Redirecting ${profile.type} user to ${dashboardPath}`,
                  );
                  router.push(dashboardPath);
                })
                .catch((error) => {
                  console.error(
                    "Error determining user type for redirect:",
                    error,
                  );
                  router.push("/client");
                });
            } else {
              router.push("/client");
            }
          } catch (error) {
            console.error("Error in redirect logic:", error);
            router.push("/client");
          }
        }}
        orderData={successOrderData}
        onViewOrderDetails={handleViewOrderDetails}
      />
    </form>
  );
};

export default CateringRequestForm;
